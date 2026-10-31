import test from 'node:test';import assert from 'node:assert/strict';
import { chunksFromSegments,selectDocument } from '../lib/content.js';
import { coverageOf,textHash } from '../lib/coverage.js';
const segments=['Introduction','Methods','Experiments','Results','Limitations'].map(title=>({locator:title,text:title+'\n'+'a'.repeat(2100)}));
test('section-aware selection keeps stable IDs and actual processed coverage',()=>{
 const all=chunksFromSegments(segments,4000,2);assert.deepEqual(all.chunks.map(c=>c.id),['P2','P3']);
 const doc={...all,segments,format:'txt'};
 const e=[{chunkId:'P2',textHash:textHash(all.allChunks[1].text)}];
 const cover=coverageOf(doc,e);assert.equal(cover.processedChunks,1);assert.equal(cover.chapters.find(c=>c.id==='methods').processed,1);
 const next=selectDocument(doc,{supplementChapters:['limitations']},{maxChunks:2,chunkChars:4000},e);
 assert.deepEqual(next.chunks.map(c=>c.id),['P2','P5']);assert.equal(doc.chunks.length,2);
});
test('paragraph keyword is not a heading and unknown remains explicit',()=>{
 const d=chunksFromSegments([{locator:'x',text:'This method uses experiments in its introduction. '.repeat(100)}],2000,1);
 assert.ok(d.allChunks.every(c=>c.chapters[0]==='unknown'));
});
