#ifndef regexp_h
#define regexp_h

typedef struct Reprog Reprog;
typedef struct Resub Resub;

Reprog *regcomp(const char *pattern, int cflags, const char **errorp);

int regexec(Reprog *prog, const char *string, Resub *sub, int eflags);

void regfree(Reprog *prog);

enum {
    /* regcomp flags */
    REG_ICASE = 1,
    REG_NEWLINE = 2,

    /* regexec flags */
    REG_NOTBOL = 4,

    /* limits */
    REG_MAXSUB = 10
};

struct Sub {
    char *sp;
    char *ep;
};

struct Resub {
    unsigned int nsub;
    struct Sub sub[REG_MAXSUB];
};

#endif
