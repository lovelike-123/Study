# 状态机编程

## 有 5 个要素，分别是状态(state)、迁移(transition)、事件(event)、动作(action)、条件(guard)。

状态：

一个系统在某一时刻所存在的稳定的工作情况，系统在整个工作周期中可能有多个状态。例如一部电动机共有正转、反转、停转这 3 种状态。
一个状态机需要在状态集合中选取一个状态作为初始状态。

迁移：

系统从一个状态转移到另一个状态的过程称作迁移，迁移不是自动发生的，需要外界对系统施加影响。停转的电动机自己不会转起来，让它转起来必须上电。

事件：

某一时刻发生的对系统有意义的事情，状态机之所以发生状态迁移，就是因为出现了事件。对电动机来讲，加正电压、加负电压、断电就是事件。

动作：

在状态机的迁移过程中，状态机会做出一些其它的行为，这些行为就是动作，动作是状态机对事件的响应。给停转的电动机加正电压，电动机由停转状态迁移到正转状态，同时会启动电机，这个启动过程可以看做是动作，也就是对上电事件的响应。

条件：

状态机对事件并不是有求必应的，有了事件，状态机还要满足一定的条件才能发生状态迁移。还是以停转状态的电动机为例，虽然合闸上电了，但是如果供电线路有问题的话，电动机还是不能转起来。

小例子：

一单片机、一按键、俩 LED 灯(记为 L1 和 L2)、一人， 足矣！

规则描述：

1、L1L2 状态转换顺序 OFF/OFF--->ON/OFF--->ON/ON--->OFF/ON--->OFF/OFF
第一步：设定时间包含几种状态，并给每种状态一个标志位
2、通过按键控制 L1L2 的状态,每次状态转换需连续按键 5 次
第二部：设置状态变化的方式（动作）
3、L1L2 的初始状态 OFF/OFF
第三步：设定初始状态，并给定状态转换图
void main(void)
{
sys_init();
led_off(LED1);
led_off(LED2);
g_stFSM.u8LedStat = LS_OFFOFF;

 <!-- 初始化状态 -->

g_stFSM.u8KeyCnt = 0;

while(1)
{
if(test*key()==TRUE)
{
fsm_active();
}
else
{
; /\_idle code*/
别得工作
}
}
}
void fsm*active(void) 状态机例程
{
if(g_stFSM.u8KeyCnt > 3) /*击键是否满 5 次*/
{
switch(g_stFSM.u8LedStat)
{
case LS_OFFOFF:
led_on(LED1); /*输出动作*/
g_stFSM.u8KeyCnt = 0;
g_stFSM.u8LedStat = LS_ONOFF; /*状态迁移*/
break;
case LS_ONOFF:
led_on(LED2); /*输出动作*/
g_stFSM.u8KeyCnt = 0;
g_stFSM.u8LedStat = LS_ONON; /*状态迁移*/
break;
case LS_ONON:
led_off(LED1); /*输出动作*/
g_stFSM.u8KeyCnt = 0;
g_stFSM.u8LedStat = LS_OFFON; /*状态迁移*/
break;
case LS_OFFON:
led_off(LED2); /*输出动作*/
g_stFSM.u8KeyCnt = 0;
g_stFSM.u8LedStat = LS_OFFOFF; /*状态迁移*/
break;
default: /*非法状态*/
led_off(LED1);
led_off(LED2);
g_stFSM.u8KeyCnt = 0;
g_stFSM.u8LedStat = LS_OFFOFF; /*恢复初始状态*/
break;
}
}
else
{
g_stFSM.u8KeyCnt++; /*状态不迁移，仅记录击键次数\_/
}
}

## 优点

### 提高 CPU 使用效率

程序状态机化，这种情况就会明显改观，程序只需要用全局变量记录下工作状态，就可以转头去干别的工作了，当然忙完那些活儿之后要再看看工作状态有没有变化。只要目标事件(定时未到、电平没跳变、串口数据没收完)还没发生，工作状态就不会改变，程序就一直重复着“查询—干别的—查询—干别的”这样的循环，这样 CPU 就闲不下来了。在程序清单 List3 中，if{}else{}语句里 else 下的内容(代码中没有添加，只是加了一条/_idle code_/的注释示意)就是上文所说的“别的工作” 。

### 逻辑完备性

状态机是一种以系统状态为中心，以事件为变量的设计方法，它专注于各个状态的特点以及状态之间相互转换的关系。状态的转换恰恰是事件引起的，那么在研究某个具体状态的时候，我们自然而然地会考虑任何一个事件对这个状态有什么样的影响。这样，每一个状态中发生的每一个事件都会在我们的考虑之中，也就不会留下逻辑漏洞。
ps:在大工程中会起到优化代码的作用，使逻辑清晰，占用 cpu 资源减少

## 实例：adc 采集

#define ADC*ACQUISITION_PERIOD_MS (unsigned short)(1000)/\_ADC 采集周期*/
#define ADC*STAT_CHECK_TIME (unsigned char)(0x00) /*检查是否到达 ADC 采集时间*/
#define ADC_STAT_START (unsigned char)(0x01) /*启动 ADC 采集*/
#define ADC_STAT_CHECK_COMPLETE (unsigned char)(0x02) /*检查 ADC 是否采集完成*/
#define ADC_STAT_CHECK_READ_DATA (unsigned char)(0x03) /*读取 ADC 采集的数据\_/

typedef struct
{
unsigned short CountMs; /_ADC 采集周期计时_/
unsigned short AdcData; /_ADC 采集的数据_/
unsigned char stat; /_ADC 模块状态变量_/
}AdcStructTypeDef;

AdcStrcutTypeDef AdcStruct;

/_将第 3 章的 main 函数增加 1 条 ADC 模块_/
int main()
{
while(1)
{
/_按键 1 模块处理_/
Key1Moudle(&Key1Stat);
/_按键 2 模块处理_/
Key2Moudle(&Key1Stat);
/_ADC 模块采集_/
AdcModule(&AdcStruct);
}
}

/_定时器 1ms 中断函数_/
void TimerInterruptMs(void)
{
/_在定时器中， 改变 ADC 的计数变量_/
pAdcStruct->CountMs++;
}

void AdcMoudle(AdcStrcutTypeDef *pAdcStruct)
{
/*根据当前状态判断执行哪一个状态处理函数*/
switch(pAdcStrcut->stat)
{
case ADC_STAT_CHECK_TIME : AdcStatCheckTime(pAdcStruct);
case ADC_STAT_START : AdcStatStart(pAdcStruct);
case ADC_STAT_CHECK_COMPLETE : AdcStatCheckComplete(pAdcStruct);
case ADC_STAT_CHECK_READ_DATA : AdcStatCheckReadData(pAdcStruct);
/*默认情况下设置状态为 ADC 检查是否到采集时间\*/
default :
pAdcStruct->stat = ADC_STAT_CHECK_TIME;
break;
}
}

void AdcStatCheckTime(AdcStrcutTypeDef *pAdcStruct)
{
if(pAdcStruct->CountMs < ADC_ACQUISITION_PERIOD_MS)
{
/*采集周期没有到达直接返回*/
return;
}
/*清零计时器*/
pAdcStruct->CountMs = 0;
/*设置状态为 启动 ADC 采集\*/
pAdcStruct->stat = ADC_STAT_START;
return;
}

void AdcStatStart(AdcStrcutTypeDef *pAdcStruct)
{
/*设置 ADC 开始转换*/
AdcStartCmd();
/*设置状态为 检查 ADC 是否采集完成\*/
pAdcStruct->stat = ADC_STAT_CHECK_COMPLETE;
return;
}

void AdcStatCheckComplete(AdcStrcutTypeDef *pAdcStruct)
{
/*读取 ADC 状态,判断是否采集完成*/
if(AdcReadCompleteStat() == 0x00)
{
/*没有采集完成直接返回*/
return;
}
/*设置状态为 检查 ADC 是否采集完成\*/
pAdcStruct->stat = ADC_STAT_CHECK_READ_DATA;
}

void AdcStatCheckReadData(AdcStrcutTypeDef *pAdcStruct)
{
/*读取 ADC 采集的数据到变量*/
pAdcStruct->AdcData = AdcReadData();
/*设置状态为 检查是否到达 ADC 采集时间\*/
pAdcStruct->stat = ADC_STAT_CHECK_TIME;
}

# 问题

ws2812b 显示不正常

## 解决方法

原因：由于 jink 供电导致电流不足使得显色错误且无法控制
通过更换供电方式解决问题

## 时间

2023 年 9 月 6 日 10:57:08

# 操作系统

    嵌入式这个领域的时候，往往首先接触的都是单片机编程，单片机编程又 首选 51 单片机来入门。这里面说的单片机编程通常都是指裸机编程，即不加入任何 RTOS （Real Time Operating System 实时操作系统）的程序。常用的 RTOS 有国外的 FreeRTOS、 μC/OS、RTX 和国内的 FreeRTOS、Huawei LiteOS 和 AliOS-Things 等，其中尤以国外开源 且免费的 FreeRTOS 的市场占有率最高。

    裸机系统中，所有的程序基本都是自己写的，所有的操作都是在一个无限的大循环 里面实现。现实生活中的很多中小型的电子产品用的都是裸机系统，而且也能够满足需求。 但是为什么还要学习 RTOS 编程，偏偏还要整个操作系统进来。
    一是项目需要，随着产品 要实现的功能越来越多，单纯的裸机系统已经不能够完美地解决问题，反而会使编程变得 更加复杂，如果想降低编程的难度，我们可以考虑引入 RTOS 实现多任务管理，这是使用 RTOS 的最大优势。
    二是学习的需要，必须学习更高级的东西，实现更好的职业规划，为 将来走向人生巅峰迎娶白富美做准备，而不是一味的在裸机编程上面死磕。作为一个合格 的嵌入式软件工程师，学习是永远不能停歇的事，时刻都得为将来准备。书到用时方恨少， 我希望机会来临时你不要有这种感觉。
    最简单的就是在别人移植好的系统之上，看看 RTOS 里面的 API 使用说明，然后调用这些 API 实现自己想要的功能即可。完全，不用关心底层 的移植，这是最简单快速的入门方法。这种方法各有利弊，如果是做产品，好处是可以快 速的实现功能，将产品推向市场，赢得先机，弊端是当程序出现问题的时候，因对这个 RTOS 不够了解，会导致调试困难，焦头烂额，一筹莫展。如果是学习，那么只会简单的 调用 API，那是不可取的，我们应该深入的学习其中一款 RTOS。

# 问题

1. 默认一般状态下，中断优先级大于任务优先级（关闭任务中断不影响 nvic）

## 解决方法

## 时间

2023 年 9 月 8 日 09:32:12

# 2023 年 9 月 8 日 14:56:04 N32A455 移植 Freertos 成功
