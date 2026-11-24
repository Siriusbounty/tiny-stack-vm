// Tiny stack VM for make.fun tiny-stack-vm-01 (test entry, written in this session).
// ISA: generator/subject/ISA.md in the kit. 32-bit wrapping ints, 256-value stack,
// 64-deep call stack, 256 words of memory, traps 2-11 with their exit codes.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
function run(program: Buffer, input: Buffer): { out: Buffer; code: number } {
  const mem = new Int32Array(256), st: number[] = [], cs: number[] = [], out: number[] = [];
  let pc = 0, ip = 0, steps = 0, code = 0;
  const trap = (c: number) => { code = c; return false; };
  const need = (n: number) => st.length < n ? trap(2) : true;
  const push = (v: number) => st.length >= 256 ? trap(3) : (st.push(v | 0), true);
  const emit = (bs: number[]) => out.length + bs.length > 65536 ? trap(11) : (out.push(...bs), true);
  const pop = () => st.pop() as number;
  const bin = (f: (a: number, b: number) => number) => {
    if (!need(2)) return false; const b = pop(), a = pop(); return push(f(a, b));
  };
  const div = (f: (a: number, b: number) => number) => {
    if (!need(2)) return false; const b = pop(), a = pop();
    if (b === 0) { trap(4); return false; } return push(f(a, b));
  };
  while (true) {
    if (steps >= 1000000) { trap(10); break; }
    if (pc < 0 || pc >= program.length) { trap(9); break; }
    const op = program[pc];
    const il = op === 1 ? 1 : op === 2 ? 4 : op >= 0x30 && op <= 0x33 ? 2 : 0;
    if (pc + 1 + il > program.length) { trap(9); break; }
    const nx = pc + 1 + il;
    steps++;
    let jmp = false;
    const s16 = () => { const v = program[pc + 1] | (program[pc + 2] << 8); return v >= 0x8000 ? v - 0x10000 : v; };
    const u16 = () => program[pc + 1] | (program[pc + 2] << 8);
    switch (op) {
      case 0: return { out: Buffer.from(out), code: 0 };
      case 1: if (!push((program[pc + 1] << 24) >> 24)) return { out: Buffer.from(out), code }; break;
      case 2: if (!push(program.readInt32LE(pc + 1))) return { out: Buffer.from(out), code }; break;
      case 3: if (!need(1)) return { out: Buffer.from(out), code }; pop(); break;
      case 4: if (!need(1) || !push(st[st.length - 1])) return { out: Buffer.from(out), code }; break;
      case 5: if (!need(2)) return { out: Buffer.from(out), code }; { const a = st[st.length - 2]; st[st.length - 2] = st[st.length - 1]; st[st.length - 1] = a; } break;
      case 6: if (!need(2) || !push(st[st.length - 2])) return { out: Buffer.from(out), code }; break;
      case 7: if (!need(3)) return { out: Buffer.from(out), code }; { const a = st[st.length - 3]; st[st.length - 3] = st[st.length - 2]; st[st.length - 2] = st[st.length - 1]; st[st.length - 1] = a; } break;
      case 0x10: if (!bin((a, b) => (a + b) | 0)) return { out: Buffer.from(out), code }; break;
      case 0x11: if (!bin((a, b) => (a - b) | 0)) return { out: Buffer.from(out), code }; break;
      case 0x12: if (!bin((a, b) => Math.imul(a, b))) return { out: Buffer.from(out), code }; break;
      case 0x13: if (!div((a, b) => Math.trunc(a / b) | 0)) return { out: Buffer.from(out), code }; break;
      case 0x14: if (!div((a, b) => (a % b) | 0)) return { out: Buffer.from(out), code }; break;
      case 0x15: if (!div((a, b) => Math.floor((a >>> 0) / (b >>> 0)) | 0)) return { out: Buffer.from(out), code }; break;
      case 0x16: if (!div((a, b) => ((a >>> 0) % (b >>> 0)) | 0)) return { out: Buffer.from(out), code }; break;
      case 0x17: if (!need(1)) return { out: Buffer.from(out), code }; { const a = pop(); if (!push((-a) | 0)) return { out: Buffer.from(out), code }; } break;
      case 0x18: if (!bin((a, b) => (a & b) | 0)) return { out: Buffer.from(out), code }; break;
      case 0x19: if (!bin((a, b) => (a | b) | 0)) return { out: Buffer.from(out), code }; break;
      case 0x1a: if (!bin((a, b) => (a ^ b) | 0)) return { out: Buffer.from(out), code }; break;
      case 0x1b: if (!need(1)) return { out: Buffer.from(out), code }; { const a = pop(); if (!push(~a)) return { out: Buffer.from(out), code }; } break;
      case 0x1c: if (!bin((a, b) => (a << (b & 31)) | 0)) return { out: Buffer.from(out), code }; break;
      case 0x1d: if (!bin((a, b) => (a >> (b & 31)) | 0)) return { out: Buffer.from(out), code }; break;
      case 0x1e: if (!bin((a, b) => (a >>> (b & 31)) | 0)) return { out: Buffer.from(out), code }; break;
      case 0x20: if (!bin((a, b) => (a === b ? 1 : 0))) return { out: Buffer.from(out), code }; break;
      case 0x21: if (!bin((a, b) => (a < b ? 1 : 0))) return { out: Buffer.from(out), code }; break;
      case 0x22: if (!bin((a, b) => ((a >>> 0) < (b >>> 0) ? 1 : 0))) return { out: Buffer.from(out), code }; break;
      case 0x30: pc = nx + s16(); jmp = true; break;
      case 0x31: if (!need(1)) return { out: Buffer.from(out), code }; if (pop() === 0) { pc = nx + s16(); jmp = true; } break;
      case 0x32: if (!need(1)) return { out: Buffer.from(out), code }; if (pop() !== 0) { pc = nx + s16(); jmp = true; } break;
      case 0x33: if (cs.length >= 64) { trap(7); return { out: Buffer.from(out), code }; } cs.push(nx); pc = u16(); jmp = true; break;
      case 0x34: if (cs.length === 0) { trap(8); return { out: Buffer.from(out), code }; } pc = cs.pop() as number; jmp = true; break;
      case 0x40: if (!need(1)) return { out: Buffer.from(out), code }; { const a = pop(); if (a < 0 || a > 255) { trap(6); return { out: Buffer.from(out), code }; } if (!push(mem[a])) return { out: Buffer.from(out), code }; } break;
      case 0x41: if (!need(2)) return { out: Buffer.from(out), code }; { const a = pop(), v = pop(); if (a < 0 || a > 255) { trap(6); return { out: Buffer.from(out), code }; } mem[a] = v | 0; } break;
      case 0x50: if (!need(1)) return { out: Buffer.from(out), code }; { const v = pop(); if (!emit([...String(v)].map((c) => c.charCodeAt(0)))) return { out: Buffer.from(out), code }; } break;
      case 0x51: if (!need(1)) return { out: Buffer.from(out), code }; if (!emit([(pop() & 255)])) return { out: Buffer.from(out), code }; break;
      case 0x52: if (!push(ip < input.length ? input[ip++] : -1)) return { out: Buffer.from(out), code }; break;
      case 0x53: if (!need(1)) return { out: Buffer.from(out), code }; return { out: Buffer.from(out), code: pop() & 255 };
      default: trap(5); return { out: Buffer.from(out), code };
    }
    if (!jmp) pc = nx;
  }
  return { out: Buffer.from(out), code };
}
for (const id of readdirSync(I).sort()) {
  const { out, code } = run(readFileSync(join(I, id, 'program.bin')), readFileSync(join(I, id, 'input.bin')));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), out);
  writeFileSync(join(O, id, 'exit.txt'), String(code) + '\n');
}
