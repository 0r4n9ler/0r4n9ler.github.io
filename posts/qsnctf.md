# 两数之和

![image-20260105153211370](https://gitee.com/oranger2530/image-hosting/raw/master/20260121232715109.png)

![image-20260105153240253](https://gitee.com/oranger2530/image-hosting/raw/master/20260121232715110.png)

这里先测试连接，看眼题目是什么样的，根据要求就用最简单的for循环去做

```py
def hs_1(l, t):
    n = len(l)
    for i in range(n):
        for j in range(i + 1, n):
            if l[i] + l[j] == t:
                return (i, j, l[i], l[j])
    return None
```

最开始想着用ai结合写个脚本的，但想着新生赛就做着完吧，自己编程能力都好像下降了，这里按照自己的思路想法去做题目

再去定义一个函数从字符串中解析出列表和目标值

```py
def hs_2(data):
    list1= re.search(r"List = (\[.*?\])", data)
    target= re.search(r"Target = (\d+)", data)

    if not list or not target:
        return None, None

    l= eval(list1.group(1))
    t= int(target.group(1))
    return l, t
```

再定义一个发送函数

```py
def hs_3(connection, answer_tuple):
    answer_str= str(answer_tuple).replace(" ", "")
    print(f"计算出答案: {answer_str}")
    connection.sendline(answer_str.encode())
    print("答案已发送")
```

 再定义一个完整流程

```py
def hs_4(connection):
    try:
        #接受
        data = connection.recvuntil(b'> ', timeout=5).decode()
        print(f"接受数据：{data}")
        #解析
        l,t=hs_2(data)
        if l is None or t is None:
            return False
        print(f"解析题目为：List={l}, Target={t}")
        #计算
        result=hs_1(l,t)
        if result is None:
            return False
        #调用
        hs_3(connection,result)
        return True
    except Exception as e:
        return False
```

最后定义主函数，测试的时候发现计算一百轮题目
完整exp:

```py
from pwn import *
import re
def hs_1(l, t):
    n = len(l)
    for i in range(n):
        for j in range(i + 1, n):
            if l[i] + l[j] == t:
                return (i, j, l[i], l[j])
    return None
def hs_2(data):
    list1= re.search(r"List = (\[.*?\])", data)
    target= re.search(r"Target = (\d+)", data)

    if not list or not target:
        return None, None

    l= eval(list1.group(1))
    t= int(target.group(1))
    return l, t
def hs_3(connection, answer_tuple):
    answer_str= str(answer_tuple).replace(" ", "")
    print(f"计算出答案: {answer_str}")
    connection.sendline(answer_str.encode())
def hs_4(connection):
    try:
        #接受
        data = connection.recvuntil(b'> ', timeout=5).decode()
        print(f"接受数据：{data}")
        #解析
        l,t=hs_2(data)
        if l is None or t is None:
            return False
        print(f"解析题目为：List={l}, Target={t}")
        #计算
        result=hs_1(l,t)
        if result is None:
            return False
        #调用
        hs_3(connection,result)
        return True
    except Exception as e:
        return False
def main():
    host='challenge.qsnctf.com'
    port=53138
    conn=remote(host,port)
    for i in range(1,101):
        print(f"第{i}轮")
        success=hs_4(conn)
        if not success:
            print("失败")
            break
    print("100轮结束")
    try:
        final_output=conn.recvall(timeout=10).decode()
        print("服务器响应结果：",final_output)
    except Exception as e:
        print("最终结果：",e)
    conn.close()
main()

```

