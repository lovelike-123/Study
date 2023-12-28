
/*
 * 1. 控制符的认识
 * 2. 构造函数的认识
 * 3. 一个名为people的类和  一个people1的对象：这个对象的属性（姓名，年龄，身高，体重）
 * 4. this的用法认识，相对于存放当前对象的指针变量，防止同一个类的方法调用相同的参数（static参数默认不带this）
 * 5. static的部分用法，class中如果有static变量或方法，他就被唯一定义。 
 * 6. 继承的简单认识，只能单继承，对于super函数有多个要注意的点。
 * 7. 同包不同类之间的访问；
 * 8. try-catch加java.utiul包的运用。
 */
package Study;

import java.util.*;

public class Study_2 {
          public static void main(String[] args) {
                    try (Scanner scanner = new Scanner(System.in)) {
                              System.out.println("我的名字：");
                              String nameString = scanner.nextLine();
                              System.out.println("我的年龄：");
                              int age = scanner.nextInt();
                              Student1 student1 = new Student1(nameString, age, 172, 70, 100);
                              student1.Judge();
                    }
                    Human china_plepeo = Human.SetHuman("黄种人", "刘磊", 23, "human");
                    Study_3.getMessageShow(china_plepeo);
          }
}

class People {
          protected String name;
          protected int age;
          protected double Height;
          protected double Weight; // 属性
          // private static String species = "People";
          private static People people;

          public static People getPeople(String name, int age, double Height, double Weight) {
                    people = new People(name, age, Height, Weight);
                    return people;
          }

          protected People(String name, int age, double Height, double Weight) {
                    this.name = name; // 对属性进行赋值。
                    this.age = age;
                    this.Height = Height;
                    this.Weight = Weight;
                    System.out.printf("我的名字叫" + this.name + ",我的年龄是" + this.age + ",我的身高是" + this.Height + "我的体重是"
                                        + this.Weight);
          }

          void Judge() {

                    char ch = name.charAt(0);
                    // System.out.println(ch);
                    if (ch > 0x4e00 && ch < 0x9fbb) {
                              System.out.println("我是中国人");
                    } else
                              System.out.println("我不是中国人");

                    if (age > 20) {
                              System.out.println("我年龄很大了");
                    } else
                              System.out.println("我还是小孩");

                    if (Height > 175) {
                              System.out.println("我是高个子");
                    } else
                              System.out.println("我不是很高");

                    if (Weight > 80) {
                              System.out.println("我是胖子");
                    } else
                              System.out.println("我不是很胖");
          }
}

class Student1 extends People {

          double score;

          public Student1(String name, int age, double Height, double Weight, double score) {
                    super(name, age, Height, Weight);
                    this.score = score;
                    System.out.printf("我的分数" + this.score + "\r\n");
          }

          void Judge() {
                    super.Judge();
                    System.out.println("我是学生");
                    if (score > 90) {
                              System.out.println("我成绩还行");
                    } else
                              System.out.println("我成绩不太行");
          }
}

class People_Arm {

}