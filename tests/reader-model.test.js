import test from 'node:test';
import assert from 'node:assert/strict';
import {currentChapter,libraryRecords} from '../client/reader-model.js';
test('reading position follows rendered order and handles empty reports',()=>{
 assert.equal(currentChapter([],100),'');
 const headings=[{id:'overview',top:200},{id:'mechanism',top:500},{id:'evidence',top:900}];
 assert.equal(currentChapter(headings,100),'overview');
 assert.equal(currentChapter(headings,500),'mechanism');
 assert.equal(currentChapter(headings,1000),'evidence');
});
test('library filtering excludes trash and supports renamed records and missing metadata',()=>{
 const records=[{displayTitle:'My ReAct'},{paper:{title:'Agent runtime'}},{displayTitle:'ReAct',record:{deletedAt:'2026-11-06'}},{}];
 assert.deepEqual(libraryRecords(records,' react '),[records[0]]);
 assert.deepEqual(libraryRecords(records,'agent'),[records[1]]);
 assert.equal(libraryRecords(records).length,3);
 assert.deepEqual(libraryRecords(records,'未识别'),[records[3]]);
});
