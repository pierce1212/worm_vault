# #define FL_BOOT_MODE     					(*(volatile uint8 *)0xB0000000u)这种用法你知道吗?

Total votes: 0
Created by: Jay
Status: New idea

## Why do you think it’s important?

- 最外层的
• *()：对该指针解引用，最终让你像访问变量一样读写这个地址。
- 解引用（dereference）就是“通过指针访问它指向的内存内容”。
    
          最常见的符号是 *：
    
    - 指针本身是一个地址：uint8 *p
    - 解引用就是取该地址里的值：*p
- 

## Supporting data

Link slack threads, data reports, etc.