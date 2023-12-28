class Song(object):

    def __init__(self, lyrics):
        self.lyrics = lyrics
        # 创建一个函数 lyr里装要放入的字符串变量，并将其赋值给happ.lyr

    def sing_me_a_song(self):
        for line in self.lyrics:
            print(line)


happy_baday = Song([
    "Happy birthday to you", "I don't want to get sued",
    "So I'll stop right there"
    # 直接给lyr赋值
])

bulls_on_parade = Song(
    ["They rally around the family", "With pockets full of shells"])

happy_baday.sing_me_a_song()

bulls_on_parade.sing_me_a_song()