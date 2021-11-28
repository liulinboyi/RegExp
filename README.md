# JavaScript版正则(RegExp)实现

> 使用JavaScript，来实现JavaScript中的正则，RegExp in JavaScript，方便大家使用自己熟悉的语言调试

- 移植于[RegExp.c](./RegExp.c)，大致上是[MuJS中的正则](https://github.com/ccxvii/mujs/blob/master/regexp.c)，MuJS仓库后续有些许变动，不是特别大

- [原仓库](https://github.com/ccxvii/minilibs/blob/master/regexp.c)

- 移植过来的可能有Bug，我只测试了[RegExp.js](./RegExp.js)中的两个用例，其他未测试。


测试用例：

```
"/root/temp/hello.mp3".match(/.+\/(.+\..+)$/)

"noonday".match(/\B../)
```