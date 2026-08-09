from sys import exit
from random import randint
from textwrap import dedent


class Scene(object):

    def enter(self):
        print("xxxxxxxxxxxxxxxxxxxxxxxx")
        print("xxxxxxxxxxxxxxxxxxxxxxxx")
        exit(1)


class Engine(object):

    def __init__(self, scene_map) -> None:
        self.scene_map = scene_map
        pass

    def play(self):
        current_scene = self.scene_map.opening_scene()
        last_scene = self.scene_map.next_scene('finished')
        while current_scene != last_scene:
            next_scene_name = current_scene.enter()
            current_scene = self.scene_map.next_scene(next_scene_name)
        pass
        current_scene.enter()


class Death(Scene):
    quips = [
        "you died. you kinda suck at this.",
        "you died. you kinda suck at this.",
        "you died. you kinda suck at this.",
        "you died. you kinda suck at this."
    ]

    def enter(self):
        print(Death.quips[randint(0, len(self.quips) - 1)])
        exit(1)
        pass


class CentraCorridor(Scene):

    def enter(self):
        print(
            dedent("""
                        xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                        xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                        xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                        xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                        xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                        xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
        """))
        action = input("> ")
        if (action == "shoot!"):
            print("""
                        xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                        xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                        xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                        xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                        xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                        xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx                        
            """)
        elif action == "dodeg!":
            print("""
                  xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                  xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                  xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                  xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx""")
            return 'death'
        elif action == "tell a joke":
            print("""
                  xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                  xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                  xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                  xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx""")
            return 'laser_weapon_armory'
        else:
            print("does not compute")
            return 'central_corridor'
        pass


class LaserWeaponArmory(Scene):

    def enter(self):
        print(
            dedent("""XXXXXXXXXXXXXXXXXXXX
                     xxxxxxxxxxxxxxxxxxxxxxxxxx
                     xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                     """))
        code = f"{randint(1,9)}{randint(1,9)}{randint(1,9)}"
        guess = input("[keypad]> ")
        guesses = 0
        while guess != code and guesses < 10:
            print("xxxxxxxxxxxxx")
            guesses += 1
            guess = input("[keypad]> ")
        if guess == code:
            print(
                dedent("""xxxxxxxxxxxxxxxxxxxxxx
                         xxxxxxxxxxxxxxxxxxxxxxxxxxxx
                         xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"""))
            return 'the_bridge'
        else:
            print("""xxxxxxxxxxxxxxxxxxxxxxxxx""")
            return 'death'

        pass


class TheBridge(Scene):

    def enter(self):
        pass


class EscapePod(Scene):

    def enter(self):
        pass


class Map(object):

    def __init__(self, start_scene) -> None:
        pass

    def next_scene(self, scene_name):
        pass

    def opening_scene(self):
        pass


a_map = Map('central_corridor')
a_game = Engine(a_map)
a_game.play()