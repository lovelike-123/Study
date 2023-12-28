import random
# 导入模块
# random()是不能直接访问的，必须导入 random 模块，
# 然后通过 random 静态对象调用该方法，即random.random() 。
# 具体效果如下所示，random()是一个最基本的随机函数，
# 作用是产生 0 到 1 之间的随机浮点数
from urllib.request import urlopen
# 负责打开浏览url内的html 文本
import sys
# 使用命令行输入

word_url = "http://learncodethehardway.org/words.txt"
# word所在的网页（可下载）
words = []

phrases = {
    "class %%%(%%%):": "Make a class named %%% that is-a %%%.",
    "class %%%(object):\n\tdef__int__(self, ***)":
    "class %%% has-a __init__that takes self and *** params.",
    "class %%%(object):\n\tdef ***(self, @@@)":
    "class %%% has-a function *** that takes self and @@@ params.",
    "*** = %%%()": "set *** to an instance of class %%%.",
    "***.***(@@@)":
    "from *** get the *** function, call it with params self, @@@.",
    "***.*** = '***'": "from *** get the *** attribute and set it to '***'"
}
if len(sys.argv) == 2 and sys.argv[1] == "english":
    # sys.argv[0]是代表当前所执行的脚本
    # sys.argv[1] 脚本第一个参数
    # 所以len(sys.argv)==2代表当前脚本含有1个参数。
    phrases_first = True
else:
    phrases_first = False

for word in urlopen(word_url).readlines():
    words.append(str(word.strip(), encoding="utf-8"))


def convert(snippet, phrase):
    class_names = [
        w.capitalize() for w in random.sample(words, snippet.count("%%%"))
    ]
    other_names = random.sample(words, snippet.count("***"))
    results = []
    param_names = []

    for i in range(0, snippet.count("@@@")):
        param_count = random.randint(1, 3)
        param_names.append(','.join(random.sample(words, param_count)))
    for sentence in snippet, phrase:
        result = sentence[:]

        for word in class_names:
            result = result.replace("%%%", word, 1)

        for word in other_names:
            result = result.replace("***", word, 1)

        for word in param_names:
            result = result.replace("@@@", word, 1)

        results.append(result)

    return results


try:
    while True:
        snippets = list(phrases.keys())
        # phrases.keys()取xxx里的键值
        # 通过list转换为列表存入  snippets
        random.shuffle(snippets)
        # random.shuffle(x)表示对列表x中的所有元素随机打乱顺序(若x不是列表,则报错)。
        # 此函数会直接对x本身进行操作
        for snippet in snippets:
            # 在打乱后的snippets中遍历
            phrase = phrases[snippet]
            question, answer = convert(snippet, phrase)
            # ,可以将一个数据类型转换为另一个数据类型。它的用法如下:
            #convert(要转换的数据, 转换后的数据类型)
            if phrases_first:
                question, answer = answer, question

            print(question)

            input("> ")
            print(f"answer: {answer}\n\n")
except EOFError:
    print("\nBye")