from random import randint


class peoPle(object):

    def __init__(self, name, level, star) -> None:
        self.name = name
        self.level = level
        self.star = star

    def winner_show(self):
        print(f"{self.name},你真的很强\n")
        if (int(self.level) <= 3):
            print("虽然水平不够，但一样通关\n")
        elif (3 < int(self.level) <= 6):
            print("这游戏难度还行吧\n")
        else:
            print("洒洒水啦\n")
        print(f"你拥有的星星数量:{self.star}\n")

    def loser_show(self):
        print(f"{self.name},怎么回事\n")
        if (int(self.level) <= 3):
            print("不过我能理解你\n")
        elif (3 < int(self.level) <= 6):
            print("是不是哪算错了\n")
        else:
            print("看来你不太行呀\n")
        print(f"你拥有的星星数量:{self.star}\n")


class Room(object):

    def __init__(self, answer, room_num) -> None:
        self.answer = answer
        self.room_num = room_num
        self.count_num1 = int(randint(0, 10))
        self.count_num2 = int(randint(0, 10))
        self.count_num3 = int(randint(0, 10))
        self.count_num4 = int(randint(0, 10))
        self.num1 = int(randint(1, 9))
        self.num2 = int(randint(1, 9))
        self.num3 = int(randint(1, 9))
        self.num4 = int(randint(1, 9))
        self.database = {
            'count0':
            f"{self.count_num1}+{self.count_num2}",
            'count1':
            f"{self.count_num1}+{self.count_num2}+{self.count_num3}",
            'count2':
            f"{self.count_num1}+{self.count_num2}+{self.count_num3}-{self.count_num4}",
            'Multiplication_division0':
            f"{self.num1}*{self.num2}",
            'Multiplication_division1':
            f"{self.num1}*{self.num2}*{self.num3}",
            'Multiplication_division2':
            f"{self.num1}/{self.num2}*{self.num3}*{self.num4}",
            'mix0':
            f"({self.count_num1}+{self.count_num2})*{self.num1}",
            'mix1':
            f"{self.count_num1}*{self.count_num2}-{self.num2}",
            'mix2':
            f"{self.count_num1}+{self.count_num2}/({self.num4}*{self.num2})",
            'boss':
            f"{self.count_num1}+{self.count_num4}/({self.num4}*{self.num2})-{self.count_num4}"
        }
        self.room_database = {
            1: 'count0',
            2: 'count1',
            3: 'count2',
            4: 'Multiplication_division0',
            5: 'Multiplication_division1',
            6: 'Multiplication_division2',
            7: 'mix0',
            8: 'mix1',
            9: 'mix2',
            10: 'boss'
        }
        self.room_answer = {
            1:
            self.count_num1 + self.count_num2,
            2:
            self.count_num1 + self.count_num2 + self.count_num3,
            3:
            self.count_num1 + self.count_num2 + self.count_num3 -
            self.count_num4,
            4:
            self.num1 * self.num2,
            5:
            self.num1 * self.num2 * self.num3,
            6:
            self.num1 / self.num2 * self.num3 * self.num4,
            7: (self.count_num1 + self.count_num2) * self.num1,
            8:
            self.count_num1 * self.count_num2 - self.num2,
            9:
            self.count_num1 + self.count_num2 / (self.num4 * self.num2),
            10:
            self.count_num1 + self.count_num4 / (self.num4 * self.num2) -
            self.count_num4
        }

    def next_room(self):
        pass


boss_flag = 0
star_flag = 3
star = 0
room_num = 1
people = input("你的名字：\n ")
level = input("你的数学水平怎么样(满分10分，输入整数)\n")
if (int(level) <= 3):
    print("那确实挺差，不过加油.相信你可以的\n")
elif (3 < int(level) <= 6):
    print("还挺不戳，加油.相信你可以的\n")
else:
    print("牛的，那不是随便过了！\n")
print("这是挑战的房间，规则是通过前九个房间，累计5个以上星星才能挑战boss房，通过boss才算挑战成功\n")

while 1:
    room = Room(0, room_num)
    if (room.room_num < 10):
        print(f"房间{room.room_num}\n")
    else:
        print("BOSS房")

    answer = int(
        input(room.database[room.room_database[room.room_num]] + "=\n"))

    if (answer != int(9999) & answer != int(room.room_answer[room.room_num])):
        star_flag = star_flag - 1
        if star_flag == 0:
            loser = peoPle(people, level, star)
            loser.loser_show()
            break
        continue

    else:
        star = star + star_flag
        room.room_num += star_flag
        room_num += star_flag
        star_flag = 3

    if (boss_flag == 1):
        if (star < 5):
            loser = peoPle(people, level, star)
            loser.loser_show()
            break
        if (star >= 5):
            winner = peoPle(people, level, star)
            winner.winner_show()
            break
    if (room.room_num > 10):
        room.room_num = 10
        boss_flag = 1
