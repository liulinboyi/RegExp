/* regcomp flags */
const REG_ICASE = 1
const REG_NEWLINE = 2

/* regexec flags */
const REG_NOTBOL = 4

/* limits */
const REG_MAXSUB = 10

const ESCAPES = "BbDdSsWw^$\\.*+?()[]{}|0123456789"

let REPINF = 255
let MAXSUB = REG_MAXSUB
let MAXPROG = (32 << 10)

L_CHAR = 256
L_CCLASS = 257 /* character class */
L_NCCLASS = 258 /* negative character class */
L_NC = 259 /* "(?:" no capture */
L_PLA = 300 /* "(?=" positive lookahead */
L_NLA = 301 /* "(?!" negative lookahead */
L_WORD = 302 /* "\b" word boundary */
L_NWORD = 303 /* "\B" non-word boundary */
L_REF = 304 /* "\1" back-reference */
L_COUNT = 305 /* {M,N} */


/* Parse */


P_CAT = 0
P_ALT = 1
P_REP = 2
P_BOL = 3
P_EOL = 4
P_WORD = 5
P_NWORD = 6
P_PAR = 7
P_PLA = 8
P_NLA = 9
P_ANY = 10
P_CHAR = 11
P_CCLASS = 12
P_NCCLASS = 13
P_REF = 14


/* Compile */


I_END = 0;
I_JUMP = 1;
I_SPLIT = 2;
I_PLA = 3;
I_NLA = 4;
I_ANYNL = 5;
I_ANY = 6;
I_CHAR = 7;
I_CCLASS = 8;
I_NCCLASS = 9;
I_REF = 10;
I_BOL = 11;
I_EOL = 12;
I_WORD = 13;
I_NWORD = 14;
I_LPAR = 15;
I_RPAR = 16



let g = {
    sub: [],
    prog: null
}

// 由于JavaScript中无法使用指针访问内存地址，在移植C语言程序时，使用数组中放置空对象模拟一片内存空间，暂时先放100个内存单元
let memory = []
for (let i = 0; i < 100; i++) {
    memory.push({})
}

function recomp(pattern, cflags) {
    console.log(pattern)
    let node;
    let split;
    let jump;
    let i = 0;
    let j = 0;

    g.pstart = null;
    g.prog = {}; // 分配内存

    n = pattern.length * 2;
    if (n > 0) {
        // 分配内存
        g.pstart = g.pend = {}
    }
    g.source = pattern;
    g.ncclass = 0;
    g.nsub = 1;
    for (i = 1; i < MAXSUB; ++i) {
        g.sub[i] = 0;
    }

    g.prog.flags = cflags;

    next()
    node = parsealt();
    if (g.lookahead === ')')
        die("unmatched ')'");
    // if (g.lookahead != 0) // c语言最后为0
    if (g.lookahead != 0) // c语言和JavaScript非严格等号相同 "" == 0 为true
        die("syntax error");

    n = 6 + count(node);
    if (n < 0 || n > MAXPROG)
        die("program too large");

    g.prog.nsub = g.nsub;

    g.prog.start = g.prog.end = memory[0];

    split = emit(g.prog, I_SPLIT);
    let splitIndex = memory.indexOf(split);
    split.x = memory[splitIndex + 3];
    split.y = memory[splitIndex + 1];
    emit(g.prog, I_ANYNL);
    jump = emit(g.prog, I_JUMP);
    jump.x = split;
    emit(g.prog, I_LPAR);
    compile(g.prog, node);
    emit(g.prog, I_RPAR);
    emit(g.prog, I_END);

    // free(g.pstart);

    // if (errorp) *errorp = NULL;

    return g.prog;
}


function toupperrune(c) {
    /* TODO: Add unicode support */
    if (c >= 'a' && c <= 'z')
        return c - 'a' + 'A';
    return c;
}

function canon(c) {
    let u = toupperrune(c);
    if (c >= 128 && u < 128)
        return c;
    return u;
}

function compile(prog, node) {
    let inst, split, jump;
    let i;
    let flag = true

    if (!node)
        return;

    loop:
        while (flag) {
            switch (node.type) {
                case P_CAT:
                    compile(prog, node.x);
                    node = node.y;
                    continue loop;

                case P_ALT:
                    split = emit(prog, I_SPLIT);
                    compile(prog, node.x);
                    jump = emit(prog, I_JUMP);
                    compile(prog, node.y);
                    let splitIndex = memory.indexOf(split);
                    let jumpIndex = memory.indexOf(jump);
                    split.x = memory[splitIndex + 1];
                    split.y = memory[jumpIndex + 1];
                    jump.x = prog.end;
                    flag = false;
                    break;

                case P_REP:
                    for (i = 0; i < node.m; ++i) {
                        inst = prog.end;
                        compile(prog, node.x);
                    }
                    if (node.m == node.n) {
                        flag = false;
                        break;
                    }
                    if (node.n < REPINF) {
                        for (i = node.m; i < node.n; ++i) {
                            split = emit(prog, I_SPLIT);
                            compile(prog, node.x);
                            if (node.ng) {
                                let splitIndex = memory.indexOf(split);
                                split.y = memory[splitIndex + 1];
                                split.x = prog.end;
                            } else {
                                let splitIndex = memory.indexOf(split);
                                split.x = memory[splitIndex + 1];
                                split.y = prog.end;
                            }
                        }
                    } else if (node.m == 0) {
                        split = emit(prog, I_SPLIT);
                        compile(prog, node.x);
                        jump = emit(prog, I_JUMP);
                        if (node.ng) {
                            let splitIndex = memory.indexOf(split);
                            split.y = memory[splitIndex + 1];
                            split.x = prog.end;
                        } else {
                            let splitIndex = memory.indexOf(split);
                            split.x = memory[splitIndex + 1];
                            split.y = prog.end;
                        }
                        jump.x = split;
                    } else {
                        split = emit(prog, I_SPLIT);
                        if (node.ng) {
                            split.y = inst;
                            split.x = prog.end;
                        } else {
                            split.x = inst;
                            split.y = prog.end;
                        }
                    }
                    flag = false;
                    break;

                case P_BOL:
                    emit(prog, I_BOL);
                    flag = false;
                    break;
                case P_EOL:
                    emit(prog, I_EOL);
                    flag = false;
                    break;
                case P_WORD:
                    emit(prog, I_WORD);
                    flag = false;
                    break;
                case P_NWORD:
                    emit(prog, I_NWORD);
                    flag = false;
                    break;

                case P_PAR:
                    inst = emit(prog, I_LPAR);
                    inst.n = node.n;
                    compile(prog, node.x);
                    inst = emit(prog, I_RPAR);
                    inst.n = node.n;
                    flag = false;
                    break;
                case P_PLA:
                    split = emit(prog, I_PLA);
                    compile(prog, node.x);
                    emit(prog, I_END);
                    splitIndex = memory.indexOf(split);
                    split.x = memory[splitIndex + 1];
                    split.y = prog.end;
                    flag = false;
                    break;
                case P_NLA:
                    split = emit(prog, I_NLA);
                    compile(prog, node.x);
                    emit(prog, I_END);
                    splitIndex = memory.indexOf(split);
                    split.x = memory[splitIndex + 1];
                    split.y = prog.end;
                    flag = false;
                    break;

                case P_ANY:
                    emit(prog, I_ANY);
                    flag = false;
                    break;
                case P_CHAR:
                    inst = emit(prog, I_CHAR);
                    inst.c = (prog.flags & REG_ICASE) ? canon(node.c) : node.c;
                    flag = false;
                    break;
                case P_CCLASS:
                    inst = emit(prog, I_CCLASS);
                    inst.cc = node.cc;
                    flag = false;
                    break;
                case P_NCCLASS:
                    inst = emit(prog, I_NCCLASS);
                    inst.cc = node.cc;
                    flag = false;
                    break;
                case P_REF:
                    inst = emit(prog, I_REF);
                    inst.n = node.n;
                    flag = false;
                    break;
            }
        }

}

function count(node) {
    let min, max, n;
    if (!node) return 0;
    switch (node.type) {
        default:
            return 1;
        case P_CAT:
            return count(node.x) + count(node.y);
        case P_ALT:
            return count(node.x) + count(node.y) + 2;
        case P_REP:
            min = node.m;
            max = node.n;
            if (min == max) n = count(node.x) * min;
            else if (max < REPINF) n = count(node.x) * max + (max - min);
            else n = count(node.x) * (min + 1) + 2;
            if (n > MAXPROG) die("program too large");
            return n;
        case P_PAR:
            return count(node.x) + 2;
        case P_PLA:
            return count(node.x) + 2;
        case P_NLA:
            return count(node.x) + 2;
    }
}

function emit(prog, opcode) {
    // Reinst *inst = prog.end++;
    let inst = prog.end; // 先将地址赋值给inst
    let index = memory.indexOf(prog.end); // 在模拟内存中寻找索引
    prog.end = memory[index + 1]; // 将模拟内存中的下一个地址赋值给end
    inst.opcode = opcode;
    inst.n = 0;
    inst.c = 0;
    inst.cc = null;
    inst.x = inst.y = null;
    return inst;
}

function accept(t) {
    if (g.lookahead == t) {
        next();
        return 1;
    }
    return 0;
}

function newnode(type) {
    // let node = g.pend++;
    let node = {}
    node.type = type;
    node.cc = null;
    node.c = 0;
    node.ng = 0;
    node.m = 0;
    node.n = 0;
    node.x = node.y = null;
    return node;
}


function parseatom() {
    let atom;
    if (g.lookahead == L_CHAR) {
        atom = newnode(P_CHAR);
        atom.c = g.yychar;
        next();
        return atom;
    }
    if (g.lookahead == L_CCLASS) {
        atom = newnode(P_CCLASS);
        atom.cc = g.yycc;
        next();
        return atom;
    }
    if (g.lookahead == L_NCCLASS) {
        atom = newnode(P_NCCLASS);
        atom.cc = g.yycc;
        next();
        return atom;
    }
    if (g.lookahead == L_REF) {
        atom = newnode(P_REF);
        if (g.yychar == 0 || g.yychar > g.nsub || !g.sub[g.yychar])
            die("invalid back-reference");
        atom.n = g.yychar;
        atom.x = g.sub[g.yychar];
        next();
        return atom;
    }
    if (accept('.'))
        return newnode(P_ANY);
    if (accept('(')) {
        atom = newnode(P_PAR);
        if (g.nsub == MAXSUB)
            die("too many captures");
        atom.n = g.nsub++;
        atom.x = parsealt();
        g.sub[atom.n] = atom;
        if (!accept(')'))
            die("unmatched '('");
        return atom;
    }
    if (accept(L_NC)) {
        atom = parsealt();
        if (!accept(')'))
            die("unmatched '('");
        return atom;
    }
    if (accept(L_PLA)) {
        atom = newnode(P_PLA);
        atom.x = parsealt();
        if (!accept(')'))
            die("unmatched '('");
        return atom;
    }
    if (accept(L_NLA)) {
        atom = newnode(P_NLA);
        atom.x = parsealt();
        if (!accept(')'))
            die("unmatched '('");
        return atom;
    }
    die("syntax error");
    return null;
}

function parserep() {
    let atom;

    if (accept('^')) return newnode(P_BOL);
    if (accept('$')) return newnode(P_EOL);
    if (accept(L_WORD)) return newnode(P_WORD);
    if (accept(L_NWORD)) return newnode(P_NWORD);

    atom = parseatom();
    if (g.lookahead == L_COUNT) {
        let min = g.yymin,
            max = g.yymax;
        next();
        if (max < min)
            die("invalid quantifier");
        return newrep(atom, accept('?'), min, max);
    }
    if (accept('*')) return newrep(atom, accept('?'), 0, REPINF);
    if (accept('+')) return newrep(atom, accept('?'), 1, REPINF);
    if (accept('?')) return newrep(atom, accept('?'), 0, 1);
    return atom;
}

function parsecat() {
    let cat, head, tail = {};
    if (g.lookahead && g.lookahead != '|' && g.lookahead != ')') {
        /* Build a right-leaning tree by splicing in new 'cat' at the tail. */
        head = parserep();
        tail.point = head; // ??
        let prev = head;
        while (g.lookahead && g.lookahead != '|' && g.lookahead != ')') {
            cat = newnode(P_CAT);
            cat.x = tail.point;
            cat.y = parserep();

            if (prev.x === tail.point) {
                tail.all.x = cat
                prev = cat
            } else if (prev.y === tail.point) {
                tail.all.y = cat
                prev = cat
            } else if (prev === tail.point) {
                head = cat
                prev = cat
            }
            tail.point = cat.y;
            tail.all = cat;
        }
        return head;
    }
    return null;
}

function empty(node) {
    if (!node) return 1;
    switch (node.type) {
        default:
            return 1;
        case P_CAT:
            return empty(node.x) && empty(node.y);
        case P_ALT:
            return empty(node.x) || empty(node.y);
        case P_REP:
            return empty(node.x) || node.m == 0;
        case P_PAR:
            return empty(node.x);
        case P_REF:
            return empty(node.x);
        case P_ANY:
        case P_CHAR:
        case P_CCLASS:
        case P_NCCLASS:
            return 0;
    }
}

function newrep(atom, ng, min, max) {
    let rep = newnode(P_REP);
    if (max == REPINF && empty(atom))
        die("infinite loop matching the empty string");
    rep.ng = ng;
    rep.m = min;
    rep.n = max;
    rep.x = atom;
    return rep;
}

function parsealt() {
    let alt, x;
    alt = parsecat();
    while (accept('|')) {
        x = alt;
        alt = newnode(P_ALT);
        alt.x = x;
        alt.y = parsecat();
    }
    return alt;
}

function next() {
    g.lookahead = lex();
}

function chartorune(r, s, key) {
    /* TODO: Add UTF-8 decoding */
    r[key] = s.slice(0, 1);
    return 1;
}


function incclasscanon(cc, c) {
    let p, r;
    for (p = cc.spans; p < cc.end; p += 2)
        for (r = p[0]; r <= p[1]; ++r)
            if (c == canon(r))
                return 1;
    return 0;
}

function incclass(cc, c) {
    let p;
    for (p = cc.spans; p < cc.end; p += 2)
        if (p[0] <= c && c <= p[1])
            return 1;
    return 0;
}

function isnewline(c) {
    return c == 0xA || c == 0xD || c == 0x2028 || c == 0x2029;
}

function iswordchar(c) {
    return c == '_' ||
        (c >= 'a' && c <= 'z') ||
        (c >= 'A' && c <= 'Z') ||
        (c >= '0' && c <= '9');
}

function die(message) {
    g.error = message;
    throw new Error(message);
    // longjmp(g.kaboom, 1);
}

function hex(c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 0xA;
    if (c >= 'A' && c <= 'F') return c - 'A' + 0xA;
    die("invalid escape sequence");
    return 0;
}

function nextrune() {
    g.source = g.source.slice(chartorune(g, g.source, "yychar"), g.source.length);
    if (g.yychar == '\\') {
        g.source = g.source.slice(chartorune(g, g.source, "yychar"), g.source.length);
        switch (g.yychar) {
            case 0:
                die("unterminated escape sequence");
                break;
            case 'f':
                g.yychar = '\f';
                return 0;
            case 'n':
                g.yychar = '\n';
                return 0;
            case 'r':
                g.yychar = '\r';
                return 0;
            case 't':
                g.yychar = '\t';
                return 0;
            case 'v':
                g.yychar = '\v';
                return 0;
            case 'c':
                g.yychar = (g.source++) & 31;
                return 0;
            case 'x':
                g.yychar = hex(g.source++) << 4;
                g.yychar += hex(g.source++);
                if (g.yychar == 0) {
                    g.yychar = '0';
                    return 1;
                }
                return 0;
            case 'u':
                g.yychar = hex(g.source++) << 12;
                g.yychar += hex(g.source++) << 8;
                g.yychar += hex(g.source++) << 4;
                g.yychar += hex(g.source++);
                if (g.yychar == 0) {
                    g.yychar = '0';
                    return 1;
                }
                return 0;
        }
        if (ESCAPES.includes(g.yychar)) {
            return 1;
        }
        // if (strchr(ESCAPES, g.yychar)) // strchr 该函数返回在字符串 str 中第一次出现字符 c 的位置，如果未找到该字符则返回 NULL。
        //     return 1;
        if (isunicodeletter(g.yychar) || g.yychar == '_') /* check identity escape */
            die("invalid escape character");
        return 0;
    }
    return 0;
}

function newcclass() {
    // #define nelem(a) (sizeof (a) / sizeof (a)[0]) 求数组长度
    // if (g.ncclass >= nelem(g.prog.cclass))
    if (g.ncclass >= g.prog.cclass.length)
        die("too many character classes");
    g.yycc = g.prog.cclass + g.ncclass++;
    g.yycc.end = g.yycc.spans;
}

function addranges_d() {
    addrange('0', '9');
}

function addranges_w() {
    addrange('0', '9');
    addrange('A', 'Z');
    addrange('_', '_');
    addrange('a', 'z');
}

function addranges_s() {
    addrange(0x9, 0x9);
    addrange(0xA, 0xD);
    addrange(0x20, 0x20);
    addrange(0xA0, 0xA0);
    addrange(0x2028, 0x2029);
    addrange(0xFEFF, 0xFEFF);
}

function addrange(a, b) {
    if (a > b)
        die("invalid character class range");
    // if (g.yycc.end + 2 == g.yycc.spans + nelem(g.yycc.spans))
    //      die("too many character class ranges");
    // g.yycc.end++ = a;
    // g.yycc.end++ = b;

    if (g.yycc.end.slice(2, g.yycc.end.length) == g.yycc.spans + g.yycc.spans.length) {
        die("too many character class ranges");
    }

    // ??
    g.yycc.end = g.yycc.end.slice(a, g.yycc.end.length);
    g.yycc.end = g.yycc.end.slice(b, g.yycc.end.length);
}

function isalpharune(c) {
    /* TODO: Add unicode support */
    return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z');
}

function isunicodeletter(c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || isalpharune(c);
}


function lex() {
    let quoted = nextrune();
    if (quoted) {
        switch (g.yychar) {
            case 'b':
                return L_WORD;
            case 'B':
                return L_NWORD;
            case 'd':
                newcclass();
                addranges_d();
                return L_CCLASS;
            case 's':
                newcclass();
                addranges_s();
                return L_CCLASS;
            case 'w':
                newcclass();
                addranges_w();
                return L_CCLASS;
            case 'D':
                newcclass();
                addranges_d();
                return L_NCCLASS;
            case 'S':
                newcclass();
                addranges_s();
                return L_NCCLASS;
            case 'W':
                newcclass();
                addranges_w();
                return L_NCCLASS;
            case '0':
                g.yychar = 0;
                return L_CHAR;
        }
        if (g.yychar >= '0' && g.yychar <= '9') {
            g.yychar -= '0';
            if (g.source >= '0' && g.source <= '9')
                g.yychar = g.yychar * 10 + g.source++ - '0';
            return L_REF;
        }
        return L_CHAR;
    }

    switch (g.yychar) {
        case 0: // C里面最后是0
        case "":
        case '$':
        case ')':
        case '*':
        case '+':
        case '.':
        case '?':
        case '^':
        case '|':
            return g.yychar;
    }

    if (g.yychar == '{')
        return lexcount();
    if (g.yychar == '[')
        return lexclass();
    if (g.yychar == '(') {
        if (g.source[0] == '?') {
            if (g.source[1] == ':') {
                g.source += 2;
                return L_NC;
            }
            if (g.source[1] == '=') {
                g.source += 2;
                return L_PLA;
            }
            if (g.source[1] == '!') {
                g.source += 2;
                return L_NLA;
            }
        }
        return '(';
    }

    return L_CHAR;
}

function strncmpcanon(a, b, n) {
    let ra, rb;
    let c;
    let tempra = {
        ra: ra
    }
    let temprb = {
        rb: rb
    }
    while (n--) {
        if (!a) return -1;
        if (!b) return 1;
        a = a.slice(chartorune(tempra, a, "ra"), a.length);
        ra = tempra.ra;
        b = b.slice(chartorune(temprb, b, "rb"), b.length);
        rb = temprb.rb;
        c = canon(ra) - canon(rb);
        if (c)
            return c;
    }
    return 0;
}

function strncmp(str1, str2, n) {
    str1 = str1.substring(0, n);
    str2 = str2.substring(0, n);
    return ((str1 == str2) ? 0 :
        ((str1 > str2) ? 1 : -1));
}

function match(pc, sp, bol, flags, out) {
    let scratch;
    let i;
    let c;
    let tempc = {
        c: c
    }
    let pcIndex;

    for (;;) {
        switch (pc.opcode) {
            case I_END:
                return 1;
            case I_JUMP:
                pc = pc.x;
                break;
            case I_SPLIT:
                scratch = out;
                if (match(pc.x, sp, bol, flags, scratch)) {
                    out = scratch;
                    return 1;
                }
                pc = pc.y;
                break;

            case I_PLA:
                if (!match(pc.x, sp, bol, flags, out))
                    return 0;
                pc = pc.y;
                break;
            case I_NLA:
                scratch = out;
                if (match(pc.x, sp, bol, flags, scratch))
                    return 0;
                pc = pc.y;
                break;

            case I_ANYNL:
                sp = sp.slice(chartorune(tempc, sp, "c"), sp.length);
                c = tempc.c;
                if (c == 0) // JavaScript中不使用严格等号 "" == 0 为true
                    return 0;
                pcIndex = memory.indexOf(pc);
                pc = memory[pcIndex + 1];
                break;
            case I_ANY:
                sp = sp.slice(chartorune(tempc, sp, "c"), sp.length);
                c = tempc.c;
                if (c == 0)
                    return 0;
                if (isnewline(c))
                    return 0;
                pcIndex = memory.indexOf(pc);
                pc = memory[pcIndex + 1];
                break;
            case I_CHAR:
                sp = sp.slice(chartorune(tempc, sp, "c"), sp.length);
                c = tempc.c;
                if (c == 0)
                    return 0;
                if (flags & REG_ICASE)
                    c = canon(c);
                if (c != pc.c)
                    return 0;
                pcIndex = memory.indexOf(pc);
                pc = memory[pcIndex + 1];
                break;
            case I_CCLASS:
                sp = sp.slice(chartorune(tempc, sp, "c"), sp.length);
                c = tempc.c;
                if (c == 0)
                    return 0;
                if (flags & REG_ICASE) {
                    if (!incclasscanon(pc.cc, canon(c)))
                        return 0;
                } else {
                    if (!incclass(pc.cc, c))
                        return 0;
                }
                pcIndex = memory.indexOf(pc);
                pc = memory[pcIndex + 1];
                break;
            case I_NCCLASS:
                sp = sp.slice(chartorune(tempc, sp, "c"), sp.length);
                c = tempc.c;
                if (c == 0)
                    return 0;
                if (flags & REG_ICASE) {
                    if (incclasscanon(pc.cc, canon(c)))
                        return 0;
                } else {
                    if (incclass(pc.cc, c))
                        return 0;
                }
                pcIndex = memory.indexOf(pc);
                pc = memory[pcIndex + 1];
                break;
            case I_REF:
                i = out.sub[pc.n].sp.length - out.sub[pc.n].ep.length;
                if (flags & REG_ICASE) {
                    if (strncmpcanon(sp, out.sub[pc.n].sp, i))
                        return 0;
                } else {
                    if (strncmp(sp, out.sub[pc.n].sp, i))
                        return 0;
                }
                if (i > 0)
                    sp = sp.slice(i, sp.length);
                pcIndex = memory.indexOf(pc);
                pc = memory[pcIndex + 1];
                break;

            case I_BOL:
                if (sp == bol && !(flags & REG_NOTBOL)) {
                    pcIndex = memory.indexOf(pc);
                    pc = memory[pcIndex + 1];
                    break;
                }
                if (flags & REG_NEWLINE) {
                    // 如果有Bug，修复建议，sp > bol之间的比较，在C语言中，sp与bol是char*指针，即内存地址，
                    // sp > bol若为true，则表示sp的内存地址（指针）较大，实际存储的有效字符个数（内存地址开头到\0之间的字符）是sp比bol少的
                    // 这和JavaScript里面字符串比较很大不同
                    // if (sp > bol && isnewline(sp[-1])) { // 原C代码
                    if (sp.length < bol.length /*改为字符串长度比较*/ && isnewline(sp[-1])) {
                        pcIndex = memory.indexOf(pc);
                        pc = memory[pcIndex + 1];
                        break;
                    }
                }
                return 0;
            case I_EOL:
                if (sp == 0) { // 在C语言和JavaScript非严格等号里面成立
                    pcIndex = memory.indexOf(pc);
                    pc = memory[pcIndex + 1];
                    break;
                }
                if (flags & REG_NEWLINE) {
                    if (isnewline(sp)) {
                        pcIndex = memory.indexOf(pc);
                        pc = memory[pcIndex + 1];
                        break;
                    }
                }
                return 0;
            case I_WORD:
                // i = sp > bol && iswordchar(sp[-1]);
                if (sp.length < bol.length) {
                    let index = bol.indexOf(sp);
                    i = iswordchar(bol[index - 1]);
                }
                i ^= iswordchar(sp[0]);
                if (!i)
                    return 0;
                pcIndex = memory.indexOf(pc);
                pc = memory[pcIndex + 1];
                break;
            case I_NWORD:
                // i = sp > bol && iswordchar(sp[-1]);
                if (sp.length < bol.length) {
                    let index = bol.indexOf(sp);
                    i = iswordchar(bol[index - 1]);
                }
                i ^= iswordchar(sp[0]);
                if (i)
                    return 0;
                pcIndex = memory.indexOf(pc);
                pc = memory[pcIndex + 1];
                break;

            case I_LPAR:
                out.sub[pc.n].sp = sp;
                pcIndex = memory.indexOf(pc);
                pc = memory[pcIndex + 1];
                break;
            case I_RPAR:
                out.sub[pc.n].ep = sp;
                pcIndex = memory.indexOf(pc);
                pc = memory[pcIndex + 1];
                break;
            default:
                return 0;
        }
    }
}

function regexec(prog, sp, sub, eflags) {
    let scratch;
    let i;

    if (!sub)
        sub = scratch;

    sub.nsub = prog.nsub;
    for (i = 0; i < MAXSUB; ++i) {
        if (!sub.sub[i]) {
            sub.sub[i] = {}
        }
        sub.sub[i].sp = sub.sub[i].ep = null;
    }

    return !match(prog.start, sp, sp, prog.flags | eflags, sub);
}

function main() {
    let m = {
        sub: []
    }

    let p = recomp(String.raw `.+\/(.+\..+)$`, 0);
    let s = "/root/temp/hello.mp3";

    // let p = recomp(String.raw `\B..`, 0);
    // let s = "noonday";

    console.log("nsub =", p.nsub)
    if (!regexec(p, s, m, 0)) {
        for (i = 0; i < m.nsub; ++i) {
            let n = m.sub[i].sp.length - m.sub[i].ep.length;
            if (n > 0)
                console.log("match %d: s=%d e=%d n=%d '%s'\n", i, (s.length - m.sub[i].sp.length), (s.length - m.sub[i].ep.length), n, m.sub[i].sp.slice(0, n));
            else
                console.log("match %d: n=0 ''\n", i);
        }
    } else {
        console.log("no match\n");
    }

}

main()