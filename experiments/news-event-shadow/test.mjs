import assert from 'node:assert/strict';
import { assessArticle, eventKey } from './rules.mjs';

const profile = { productsById:new Map([
  ['server',{relationshipLevel:'direct'}],['chip',{relationshipLevel:'upstream'}]
]) };
const article = {publishedAt:'2026-11-26'};
const blank = {paragraph_id:'',quote:''};
const quote = (id,text) => ({paragraph_id:id,quote:text});
const production = 'A server assembly line entered production.';
const base = { subject:'Manufacturer A',object:'server assembly line', signal:'capacity_change',
  business_id:'server',relation:'direct',status:'in_production',event_date:'2026-11-26',
  claim_status:'confirmed',kind:'capacity_milestone',counterpart:'',
  change:{dimension:'capacity',direction:'increase',before:'',after:'',unit:''},
  impact:{affected_business_id:'',dimension:'unknown',direction:'unknown',basis:'unknown'},
  evidence:{object:quote('p1',production),change:quote('p1',production),
    status:quote('p1',production),impact:blank,conditions:blank} };
const check = (fact, paragraphs = [['p1',production]], kind = 'report') => assessArticle(article,{
  paragraphs:paragraphs.map(([paragraph_id,text])=>({paragraph_id,text}))
},{article_kind:kind,events:[fact]},profile,'2026-11-27');
assert.equal(check(base).tier,'focus');

const zh = '服务器整机装配产线已经正式投产。';
const translated = {...base,subject:'另一家公司',object:'服务器整机装配产线',
  evidence:{...base.evidence,object:quote('p2',zh),change:quote('p2',zh),status:quote('p2',zh)}};
assert.equal(check(translated,[['p2',zh],['p1','企业还有其他项目。']]).tier,'focus');
const plan = 'The company signed a plan to add a server assembly line next June.';
const future = {...base,status:'planned',event_date:'',
  evidence:{...base.evidence,object:quote('p1',plan),change:quote('p1',plan),status:quote('p1',plan)}};
assert.equal(check(future,[['p1',plan]]).tier,'archive');
assert.equal(check({...future,evidence:{...future.evidence,conditions:quote('p1',plan)}},[['p1',plan]]).selected.status,'planned');
assert.notEqual(eventKey(base),eventKey({...base,status:'planned'}));

const impact = 'The chip was validated in the rack and changed the server interface design.';
const indirect = {...base,object:'controller chip',business_id:'chip',relation:'upstream',signal:'engineering_result',
  kind:'actual_validation',status:'validated',
  impact:{affected_business_id:'server',dimension:'design',direction:'change',basis:'stated'},
  evidence:{object:quote('p2',impact),change:quote('p2',impact),status:quote('p2',impact),impact:quote('p2',impact),conditions:blank}};
assert.equal(check(indirect,[['p2',impact]]).rule,'stated_indirect_impact');
assert.equal(check({...indirect,impact:{...indirect.impact,basis:'inferred'},evidence:{...indirect.evidence,impact:blank}},[['p2',impact]]).tier,'needs_evidence');
assert.equal(check(indirect,[['p2','The chip raises bandwidth by twenty percent.']]).tier,'needs_evidence');
assert.equal(check(base,undefined,'sponsored').tier,'archive');
assert.equal(check({...base,claim_status:'unconfirmed_report'}).tier,'archive');
assert.equal(check({...base,business_id:'chip'}).rule,'invalid_business_mapping');
const market = {...base,kind:'procurement_or_supply',signal:'market_shift',status:'not_applicable',
  change:{...base.change,dimension:'procurement'},claim_status:'attributed_forecast',
  evidence:{...base.evidence,status:blank}};
assert.equal(check(market).tier,'observation');
console.log('Structured event admission checks passed');
