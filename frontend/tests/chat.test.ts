import assert from 'node:assert/strict'
import test from 'node:test'

import { cleanAssistantContent } from '../src/utils/chat.ts'

test('removes complete annotation blocks', () => {
  assert.equal(
    cleanAssistantContent('正文<annotation>原文|批注</annotation>'),
    '正文'
  )
})

test('removes a malformed trailing annotation block', () => {
  assert.equal(
    cleanAssistantContent('正文\n<annotation>|清莲初绽不随波逐流的定力\n>'),
    '正文'
  )
})

test('removes an orphan annotation closing tag', () => {
  assert.equal(cleanAssistantContent('正文</annotation>'), '正文')
})
