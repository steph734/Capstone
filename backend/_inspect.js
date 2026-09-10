const m = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../../../../../../../Desktop/capstone/backend/.env') });

// fallback: read env from backend/.env explicitly
const fs = require('fs');
if (!process.env.MONGO_URI) {
  const envPath = 'C:/Users/ADMIN/Desktop/capstone/backend/.env';
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((l) => {
    const mm = l.match(/^\s*MONGO_URI\s*=\s*(.+)\s*$/);
    if (mm && !l.trim().startsWith('#')) process.env.MONGO_URI = mm[1];
  });
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return v.length ? `array<${typeOf(v[0])}>` : 'array';
  if (v instanceof Date) return 'date';
  if (v && v._bsontype === 'ObjectId') return 'ObjectId';
  if (v && typeof v === 'object' && v.constructor && v.constructor.name === 'ObjectId') return 'ObjectId';
  return typeof v;
}

(async () => {
  await m.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 20000 });
  const db = m.connection.db;
  const cols = (await db.listCollections().toArray()).map((c) => c.name).sort();
  for (const name of cols) {
    const coll = db.collection(name);
    const count = await coll.estimatedDocumentCount();
    const docs = await coll.find({}).limit(50).toArray();
    // union of keys across sampled docs
    const keys = {};
    docs.forEach((d) => {
      Object.entries(d).forEach(([k, v]) => {
        if (!keys[k]) keys[k] = new Set();
        keys[k].add(typeOf(v));
      });
    });
    console.log(`\n===== ${name}  (count≈${count}, sampled ${docs.length}) =====`);
    if (docs.length === 0) {
      console.log('  (empty)');
      continue;
    }
    Object.entries(keys).forEach(([k, set]) => {
      console.log(`  ${k}: ${[...set].join(' | ')}`);
    });
    console.log('  --- sample doc ---');
    console.log(JSON.stringify(docs[0], null, 2).split('\n').map((l) => '  ' + l).join('\n'));
  }
  await m.disconnect();
})().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
