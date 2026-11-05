const fs = require('fs');
const base = 'c:/Users/Bariscan/Desktop/Kiro Workspace/easycogs/';
function load(n){ const s=JSON.parse(fs.readFileSync(base+n,'utf8').trim()); return {
  cogO:JSON.parse(s['CogO']), flagU:JSON.parse(s['FlagU']), flagP:JSON.parse(s['FlagP']) }; }

const A=load('example.txt');   // tiny board unlocked, 27 tiny cogs
const B=load('example2.txt');  // no tiny board

// For each save, within spare region (108-251), classify every slot:
//   type: tiny(CogSm) / regularCog / blank
//   flagU state: -11 / 0 / special
function dumpSpare(name, d){
  console.log('\n===== '+name+' spare region 108-251 =====');
  console.log('idx | FlagU     | CogO');
  for(let i=108;i<252;i++){
    const fu=d.flagU[i];
    const st = fu===-11?'-11':(fu===0?'0':'SPECIAL');
    const c=d.cogO[i];
    const isTiny = typeof c==='string'&&c.startsWith('CogSm');
    // only print interesting (non 0-blank) rows to keep it short
    if(st!=='0' || c!=='Blank') console.log('  '+String(i).padStart(3)+' | '+st.padEnd(7)+' | '+c+(isTiny?'  <tiny>':''));
  }
}
dumpSpare('example1', A);
dumpSpare('example2', B);

// Hypothesis: is there a fixed index range that is "tiny slots" regardless of account?
// Compare the FlagU !==0 spare indices in A vs any marker in B.
function spareActive(d){ const a=[]; for(let i=108;i<252;i++) if(d.flagU[i]!==0) a.push(i); return a; }
console.log('\nexample1 spare active (FlagU!=0):', spareActive(A).join(','));
console.log('example2 spare active (FlagU!=0):', spareActive(B).join(','));

// Also: where are tiny CogSm codes in each
function tinyIdx(d){ const a=[]; d.cogO.forEach((c,i)=>{if(typeof c==='string'&&c.startsWith('CogSm'))a.push(i);}); return a; }
console.log('\nexample1 tiny CogSm indices:', tinyIdx(A).join(','));
console.log('example2 tiny CogSm indices:', tinyIdx(B).join(',') || '(none)');
