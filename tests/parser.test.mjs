import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseExam} from '../dist/parser.mjs';
import {interpret} from '../dist/clinical.mjs';
const cases = Object.fromEntries(JSON.parse(readFileSync(new URL('./fixtures/laudos-colados.json', import.meta.url))).map(([n, t]) => [n.slice(0, 2), t]));
const std = {fev1: {pre: 2, post: 2.4, pred: 3.32, lln: 2.5}, fvc: {pre: 3.5, post: 3.65, pred: 4.2, lln: 3.2}};

for (const id of ['02', '03', '05', '06', '07', '08', '09', '10', '16']) {
  test(`formato ${id}: espirometria completa extraída`, () => {
    const s = parseExam(cases[id]).spirometry;
    assert.deepEqual(s.fev1, std.fev1); assert.deepEqual(s.fvc, std.fvc);
    assert.equal(s.ratio.lln, 67);
    assert.equal(interpret(s).pattern, 'obstruction');
  });
}
test('só pré-BD com coluna "Medido"', () => {
  const s = parseExam(cases['04']).spirometry;
  assert.deepEqual(s.fev1, {pre: 3.1, pred: 3.32, lln: 2.5});
  assert.equal(interpret(s).pattern, 'normal');
});
test('relação em fração vira porcentagem sem resíduo de ponto flutuante', () => {
  assert.equal(parseExam(cases['15']).spirometry.ratio.pre, 57);
});
test('cabeçalho único lê espirometria e módulos complementares', () => {
  const p = parseExam(cases['12']);
  assert.equal(p.spirometry.ratio.lln, 67);
  assert.deepEqual(p.volumes.tlc, {measured: 4.1, pred: 6.3, lln: 5.25});
  assert.equal(p.diffusion.dlco.measured, 14.2);
});
test('rótulos de equipamento de DLCO (DLCO SB, DLCO/VA)', () => {
  const p = parseExam(cases['13']);
  assert.equal(p.diffusion.dlco.measured, 14.2);
  assert.equal(p.diffusion.kco.measured, 3.64);
  assert.equal(p.diffusion.va.measured, 3.9);
});
test('oscilometria com X5 negativo', () => {
  const p = parseExam(cases['18']);
  assert.deepEqual(p.resistance.x5, {measured: -0.25, pred: -0.1, lln: -0.18});
  assert.equal(p.settings.resistanceMethod, 'osc');
});
test('laudo completo: dados do paciente, método e todos os módulos', () => {
  const p = parseExam(cases['19']);
  assert.deepEqual(p.demographics, {sex: 'M', age: 50, height: 175, weight: 70, hemoglobin: 12, date: '2026-11-10', patient: 'Fulano de Tal'});
  assert.equal(p.settings.volumeMethod, 'pleth');
  assert.equal(p.spirometry.fev1.post, 2.15);
  assert.equal(p.volumes.rvtlc.measured, 49);
  assert.equal(p.diffusion.kco.measured, 2.46);
  assert.equal(p.skipped.length, 0);
});
test('idade pela data de nascimento; altura em metros', () => {
  const d = parseExam(cases['20']).demographics;
  assert.equal(d.age, 56); assert.equal(d.height, 162); assert.equal(d.sex, 'F'); assert.equal(d.patient, 'Maria X');
});
test('tabela markdown com célula vazia', () => {
  const s = parseExam(cases['22']).spirometry;
  assert.deepEqual(s.fev1, std.fev1); assert.equal(s.ratio.post, undefined);
});
test('sem cabeçalho: nada é adivinhado e as linhas são reportadas', () => {
  const p = parseExam(cases['23']);
  assert.deepEqual(p.spirometry, {}); assert.equal(p.skipped.length, 2);
});
test('VEF1 isolado reduzido não é rotulado como "referências insuficientes"', () => {
  assert.equal(interpret(parseExam(cases['21']).spirometry).pattern, 'low-fev1');
});
test('volumes em mL com unidade explícita são convertidos para litros', () => {
  const s = parseExam('Parametro Previsto LIN Pre\nVEF1 mL 3320 2500 2000\nCVF mL 4200 3200 3500').spirometry;
  assert.deepEqual(s.fev1, {pred: 3.32, lln: 2.5, pre: 2});
});
test('frase com número após o cabeçalho não substitui as colunas', () => {
  const s = parseExam('Parametro Previsto LIN Pre Pos\nTeste pre e pos BD com 400 mcg\nVEF1 3,32 2,50 2,00 2,40').spirometry;
  assert.equal(s.fev1.post, 2.4);
});
