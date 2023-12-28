
/**
 * 1. 对于数据的基本处理，是继承自c，有些许差距
 * 2. 生成的class类似于c的结构体，生成的对象类似于结构体指针变量
 * 3. 将指针这种危险的东西屏蔽掉了
 * 4. 生成的class通过动态内存分配存于堆中，new的对象存于栈中，随包含他的class，对象释放
 * 5. java中的函数叫做方法，是在类中使用，一般不独立出来（未学习）
 * 6. xxx.class file 类似于xxx.hex file 是编译器的执行文件，名字一般为class的类名
 * 
 */
package Study;

class A {
          int A1 = 0;
          int A2 = 1;

}

public class Study_1 {
          public static void main(String[] args) {
                    A aa1 = new A();//
                    A aa2 = aa1;
                    System.out.printf(" aa1.A1= %d\taa1.A2 = %d\r\n", aa1.A1, aa1.A2);
                    System.out.printf(" aa2.A1= %d\taa2.A2 = %d", aa2.A1, aa2.A2);

          }
}
