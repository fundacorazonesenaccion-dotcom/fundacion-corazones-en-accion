'use strict';
const express = require('express');
const helmet = require('helmet');
const { createClient } = require('@libsql/client');
const crypto = require('node:crypto');
const path = require('node:path');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'none'"],
      frameAncestors: ["'none'"]
    }
  },
  referrerPolicy: { policy: 'no-referrer' },
  hsts: { maxAge: 31536000, includeSubDomains: true }
}));
app.use('/api',(_req,res,next)=>{res.set('Cache-Control','no-store, max-age=0');next();});
app.use(express.json({ limit: '24kb' }));
const url = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;
const adminPassword = process.env.ADMIN_PASSWORD;
const sessionSecret = process.env.SESSION_SECRET;
// Bloqueo seguro: no se aceptan datos públicos reales hasta habilitar explícitamente producción.
const realDataEnabled = process.env.ALLOW_REAL_DATA === 'true';
const backupKey = process.env.BACKUP_ENCRYPTION_KEY || '';
const backupKeyBytes = /^[a-f0-9]{64}$/i.test(backupKey) ? Buffer.from(backupKey, 'hex') : null;

if (!url || !token || !adminPassword || !sessionSecret || sessionSecret.length < 32) {
  console.error('Faltan TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, ADMIN_PASSWORD o SESSION_SECRET (mínimo 32 caracteres).');
  process.exit(1);
}
const db = createClient({ url, authToken: token });
let ready = false;
const state = new Map();
function limit(key, max, periodMs) {
  const now = Date.now();
  const prev = state.get(key);
  const row = (!prev || prev.until < now) ? {count: 0, until: now + periodMs} : prev;
  row.count += 1; state.set(key,row);
  if (state.size > 15000) { for (const [k,v] of state) if (v.until < now) state.delete(k); }
  return row.count <= max;
}
function requestLimit(req,res,next){ if(!limit('post:'+req.ip,12,3600000)) return res.status(429).json({error:'Límite de solicitudes alcanzado.'}); next(); }
function safeText(value, max=2000){ return typeof value === 'string' ? value.trim().slice(0,max) : ''; }
function parseCookies(req){ return Object.fromEntries((req.headers.cookie || '').split(';').map(s=>s.trim()).filter(Boolean).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)]})); }
function sign(payload){return crypto.createHmac('sha256',sessionSecret).update(payload).digest('base64url');}
function validSession(req){const cookie=parseCookies(req).ceasession; if(!cookie)return false;const pieces=cookie.split('.');if(pieces.length!==2)return false;const [payload,mac]=pieces;const actual=Buffer.from(sign(payload)), supplied=Buffer.from(mac);if(actual.length!==supplied.length||!crypto.timingSafeEqual(actual,supplied))return false;const expiry=Number(payload);return Number.isFinite(expiry)&&expiry>Date.now()&&expiry<Date.now()+86400001;}
function requireAdmin(req,res,next){if(!validSession(req))return res.status(401).json({error:'Sesión no autorizada'});next();}
function sameOrigin(req,res,next){
 const origin=req.headers.origin;
 const site=req.headers['sec-fetch-site'];
 if(site && !['same-origin','none'].includes(site))return res.status(403).json({error:'Origen no permitido'});
 if(origin){try{if(new URL(origin).host!==req.get('host') || new URL(origin).protocol!=='https:' && process.env.NODE_ENV==='production')return res.status(403).json({error:'Origen no permitido'});}catch{return res.status(403).json({error:'Origen no permitido'});}}
 next();
}
app.use('/api',sameOrigin);
app.get('/api/health', async(req,res)=>{try{await db.execute('SELECT 1');res.json({ok:true,database:'conectada'});}catch(e){res.status(503).json({ok:false,database:'no disponible'});}});
app.get('/api/public/status',(_req,res)=>res.json({modo:realDataEnabled?'produccion':'pruebas',aceptaSolicitudesReales:realDataEnabled}));
app.post('/api/public/solicitudes',requestLimit,async(req,res)=>{
 if(!realDataEnabled && req.get('x-corazones-test')!=='test-fixture')return res.status(503).json({error:'Sistema en pruebas: no envíes datos personales reales.'});
 const p=req.body;
 if(!p || typeof p !== 'object'||Array.isArray(p))return res.status(400).json({error:'Solicitud inválida'});
 const type=safeText(p.tipo,35);
 if(!['reporte_caso','apadrinamiento','voluntariado'].includes(type))return res.status(400).json({error:'Tipo inválido'});
 const name=safeText(p.nombre,120), mail=safeText(p.correo,160), phone=safeText(p.telefono,40);
 if(type==='reporte_caso'&&!safeText(p['Descripción'],2500))return res.status(400).json({error:'Debes incluir una descripción.'});
 if(type!=='reporte_caso' && (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)||!phone))return res.status(400).json({error:'Datos de contacto inválidos'});
 const extras = {};
 for(const [k,v] of Object.entries(p)){if(['tipo','origen','nombre','correo','telefono'].includes(k))continue;if(Object.keys(extras).length>=15)break;extras[safeText(k,70)] = safeText(v,2500);}
 try{const id=crypto.randomUUID();await db.execute({sql:'INSERT INTO solicitudes (id,tipo,origen,nombre,correo,telefono,detalles,estado,created_at) VALUES (?,?,?,?,?,?,?, ?, ?)',args:[id,type,'APP',name,mail,phone,JSON.stringify(extras),'pendiente',new Date().toISOString()]});res.status(201).json({ok:true,id});}
 catch(e){console.error('db insert failed',e.message);res.status(503).json({error:'No se pudo guardar la solicitud'});}
});
app.post('/api/admin/login',async(req,res)=>{
 if(!limit('auth:'+req.ip,8,900000))return res.status(429).json({error:'Demasiados intentos'});
 const provided=Buffer.from(safeText(req.body?.password,250));const expected=Buffer.from(adminPassword);
 if(provided.length!==expected.length || !crypto.timingSafeEqual(provided,expected))return res.status(401).json({error:'Contraseña incorrecta'});
 const expiry=String(Date.now()+8*3600000);
 res.cookie('ceasession',expiry+'.'+sign(expiry),{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:8*3600000});res.json({ok:true});
});
app.get('/api/admin/session',requireAdmin,(_req,res)=>res.json({ok:true,modo:realDataEnabled?'produccion':'pruebas',backupDisponible:!!backupKeyBytes}));
app.get('/api/admin/backup',requireAdmin,async(_req,res)=>{
 if(!backupKeyBytes)return res.status(503).json({error:'Respaldo cifrado no configurado. Define BACKUP_ENCRYPTION_KEY.'});
 try{
  const {rows}=await db.execute('SELECT * FROM solicitudes ORDER BY created_at ASC');
  const payload=Buffer.from(JSON.stringify({schema:'corazones-solicitudes-v1',exportedAt:new Date().toISOString(),rows}));
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',backupKeyBytes,iv);
  const encrypted=Buffer.concat([cipher.update(payload),cipher.final()]);
  const tag=cipher.getAuthTag();
  const record={format:'corazones-backup-v1',algorithm:'aes-256-gcm',iv:iv.toString('base64'),tag:tag.toString('base64'),data:encrypted.toString('base64')};
  res.set('Content-Type','application/json; charset=utf-8');
  res.set('Content-Disposition',`attachment; filename="corazones-backup-${new Date().toISOString().slice(0,10)}.encrypted.json"`);
  res.send(JSON.stringify(record));
 }catch(e){console.error('backup failed',e.message);res.status(503).json({error:'No fue posible generar el respaldo'});}
});
app.post('/api/admin/logout',requireAdmin,(_req,res)=>{res.clearCookie('ceasession',{path:'/',secure:true,sameSite:'strict'});res.json({ok:true});});
app.get('/api/admin/solicitudes',requireAdmin,async(req,res)=>{try{const {rows}=await db.execute('SELECT * FROM solicitudes ORDER BY created_at DESC LIMIT 500');res.json({items:rows});}catch(e){res.status(503).json({error:'Error consultando solicitudes'});}});
app.patch('/api/admin/solicitudes/:id',requireAdmin,async(req,res)=>{const status=safeText(req.body?.estado,40),nota=safeText(req.body?.nota,2000);if(!['pendiente','en_gestion','cerrada'].includes(status))return res.status(400).json({error:'Estado no válido'});try{const result=await db.execute({sql:'UPDATE solicitudes SET estado=?,nota=? WHERE id=?',args:[status,nota,req.params.id]});res.json({ok:result.rowsAffected>0});}catch(e){res.status(503).json({error:'No se pudo actualizar'});}});
app.use(express.static(__dirname,{extensions:['html']}));
app.get('/admin',(_req,res)=>res.sendFile(path.join(__dirname,'admin.html')));
app.get('*',(_req,res)=>res.sendFile(path.join(__dirname,'index.html')));
(async()=>{try{await db.execute(`CREATE TABLE IF NOT EXISTS solicitudes (id TEXT PRIMARY KEY,tipo TEXT NOT NULL,origen TEXT,nombre TEXT,correo TEXT,telefono TEXT,detalles TEXT,estado TEXT NOT NULL DEFAULT 'pendiente',nota TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL)`);ready=true;const port=process.env.PORT||10000;app.listen(port,'0.0.0.0',()=>console.log('Servidor listo puerto',port));}catch(e){console.error('No se pudo inicializar Turso:',e.message);process.exit(1);}})();
