import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewCandidates,validateReviews} from '../lib/review.js';
const evidence=[{facts:[{id:'P1.F1',quote:'Accuracy improves on dataset A against baseline B.'}]}];
const research={references:[],citations:[],discovery:[]};
test('valid citations do not automatically validate performance or product claims',()=>{
 const candidates=reviewCandidates([{id:'paper',findings:[{kind:'paper-fact',statement:'Accuracy improves 20% everywhere.',evidenceIds:['P1.F1']},{kind:'proposal',statement:'Reduce production costs.',evidenceIds:['P1.F1']},{kind:'unknown',statement:'Unknown result.',evidenceIds:[]}]}],evidence,research);
 assert.equal(candidates[0].highRisk,true);
 assert.deepEqual(candidates.map(c=>c.status),['manual','manual','insufficient']);
 const value={reviews:candidates.map(c=>({id:c.id,status:'direct',reason:'All conditions supposedly supported.',dimensions:{object:'supported',dataset:'supported',baseline:'supported',metric:'supported',conditions:'supported'}}))};
 value.reviews[0].dimensions.conditions='unknown';
 assert.deepEqual(validateReviews(value,candidates).map(r=>r.status),['manual','manual','insufficient']);
 assert.throws(()=>validateReviews({reviews:[value.reviews[0],value.reviews[0]]},candidates));
 const changed=reviewCandidates([{id:'paper',findings:[{kind:'paper-fact',statement:'Accuracy improves 20% everywhere.',evidenceIds:['P1.F1']}]}],[{facts:[{id:'P1.F1',quote:'Different experiment'}]}],research);
 assert.notEqual(changed[0].fingerprint,candidates[0].fingerprint);
});
