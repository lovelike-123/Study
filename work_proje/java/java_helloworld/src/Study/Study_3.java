/*
 * 1. package 的初步认识 interface的初步认识
 * 2. void 两边小中间大； define 全大； 变量全小； class 全小；  
 * 
 * 
 * 
 * 
 */

package Study;

public class Study_3 {
          public static void main(String[] args) {
                    Human china_plepeo = Human.SetHuman("黄种人", "刘磊", 23, "human");
                    Student student_plepeo = Student.SetStudent("黄种人", "刘磊", 23, "无锡学院");
                    getMessageShow(china_plepeo); // 验证多态
                    student_plepeo.move(); // 验证抽象函数
                    It it = Human.SetHuman("黄种人", "刘磊", 23, "human");
                    it.do_1();
          }

          public static void getMessageShow(Human human) {
                    human.MessageShow();
                    human.eat();
          }
}

interface It {
          int A = 0;

          void do_1();
}

abstract class Biology implements It {
          public String mybiology;

          abstract void move();

          abstract void eat();
}

class Human extends Biology {

          public String color;
          public String name;
          public int age;

          public Human(String color, String name, int age, String mybiology) {
                    this.age = age;
                    this.color = color;
                    this.name = name;
                    this.mybiology = mybiology;
          }

          public static Human SetHuman(String color, String name, int age, String mybiology) {
                    Human human = new Human(color, name, age, mybiology);
                    return human;
          }

          protected String messageinfor() {
                    return (color + ":" + name + ":" + age);

          }

          protected void MessageShow() {
                    System.out.println(messageinfor());
          }

          public void move() {
                    System.out.println("move by foot!!!!!");
          }

          public void eat() {
                    System.out.println("eat by mouth!!!!!");
          }

          public void do_1() {
                    System.out.println("Do_1 test!!!!!");
          }

}

class Student extends Human {
          protected String school;

          public Student(String color, String name, int age, String school) {
                    super(color, name, age, "human");
                    this.school = school;
          }

          public static Student SetStudent(String color, String name, int age, String school) {
                    Student student = new Student(color, name, age, school);
                    return student;
          }

          protected String messageinfor() {

                    return (super.messageinfor() + ":" + school);
          }

          protected void MessageShow() {
                    System.out.println(messageinfor());
          }
}
