import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import {
  SearchBar, Selector, Popup, Picker, Input, TextArea,
  Button, Dialog, SwipeAction, Toast, Empty,
} from 'antd-mobile'
import { db } from '../db'
import {
  CATEGORIES, EQUIPMENTS, METRIC_LABEL,
  type Category, type Exercise, type Metric,
} from '../db/types'
import { IconChevron } from '../components/Icons'

const CAT_OPTIONS = CATEGORIES.map(c => ({ label: c, value: c }))
const EQUIP_OPTIONS = EQUIPMENTS.map(e => ({ label: e, value: e }))
const METRIC_OPTIONS = (Object.keys(METRIC_LABEL) as Metric[]).map(m => ({ label: METRIC_LABEL[m], value: m }))

export default function Exercises() {
  const nav = useNavigate()
  const list = useLiveQuery(() => db.exercises.orderBy('createdAt').toArray(), [], [] as Exercise[])

  const [kw, setKw] = useState('')
  const [cat, setCat] = useState<string>('all')

  const [show, setShow] = useState(false)
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>('胸')
  const [equipment, setEquipment] = useState<string>('杠铃')
  const [metric, setMetric] = useState<Metric>('weight_reps')
  const [note, setNote] = useState('')
  const [picker, setPicker] = useState<null | 'cat' | 'equip' | 'metric'>(null)

  const openAdd = () => {
    setEditing(null)
    setName(''); setCategory('胸'); setEquipment('杠铃'); setMetric('weight_reps'); setNote('')
    setShow(true)
  }
  const openEdit = (e: Exercise) => {
    setEditing(e)
    setName(e.name); setCategory(e.category); setEquipment(e.equipment); setMetric(e.metric); setNote(e.note ?? '')
    setShow(true)
  }
  const save = async () => {
    const n = name.trim()
    if (!n) { Toast.show('请填写动作名称'); return }
    const dup = await db.exercises.where('name').equalsIgnoreCase(n).first()
    if (dup && dup.id !== editing?.id) { Toast.show(`已存在同名动作「${dup.name}」`); return }
    if (editing?.id != null) {
      await db.exercises.update(editing.id, { name: n, category, equipment, metric, note: note.trim() || undefined })
      Toast.show('已保存')
    } else {
      await db.exercises.add({
        name: n, category, equipment, metric, isCustom: true,
        note: note.trim() || undefined, createdAt: Date.now(),
      })
      Toast.show('已添加')
    }
    setShow(false)
  }
  const onDelete = async (e: Exercise) => {
    if (e.id == null) return
    const ok = await Dialog.confirm({ content: `删除动作「${e.name}」？`, confirmText: '删除', cancelText: '取消' })
    if (ok) { await db.exercises.delete(e.id); Toast.show('已删除') }
  }

  const filtered = list.filter(e => {
    if (cat !== 'all' && e.category !== cat) return false
    if (kw && !e.name.toLowerCase().includes(kw.toLowerCase())) return false
    return true
  })

  return (
    <>
      <header className="nav">
        <div className="nav-left" onClick={() => nav(-1)}>返回</div>
        动作库
        <div className="nav-right" onClick={openAdd}>+ 新建</div>
      </header>
      <main className="body">
        <SearchBar value={kw} onChange={setKw} placeholder="搜索动作名称" />

        <div style={{ padding: '12px 0 4px' }}>
          <Selector
            options={[{ label: '全部', value: 'all' }, ...CAT_OPTIONS]}
            value={[cat]}
            onChange={(v) => setCat((v[0] as string) ?? 'all')}
          />
        </div>

        {filtered.length === 0 ? (
          <Empty description="没有匹配的动作" />
        ) : (
          <div className="card" style={{ paddingTop: 0 }}>
            {filtered.map(e => {
              const row = (
                <div
                  className="list-item"
                  onClick={() => e.isCustom ? openEdit(e) : Toast.show('系统动作为内置，不可编辑')}
                >
                  <div className="grow">
                    <div className="name">{e.name}</div>
                    <div className="small muted" style={{ marginTop: 4 }}>
                      <span className="tag">{e.category}</span>
                      <span className="tag gray">{e.equipment}</span>
                      {METRIC_LABEL[e.metric]}
                    </div>
                  </div>
                  <span className="tag gray">{e.isCustom ? '自定义' : '系统'}</span>
                  {e.isCustom && <IconChevron size={18} />}
                </div>
              )
              return e.isCustom ? (
                <SwipeAction
                  key={e.id}
                  rightActions={[{ key: 'del', text: '删除', color: 'danger', onClick: () => onDelete(e) }]}
                >
                  {row}
                </SwipeAction>
              ) : (
                <div key={e.id}>{row}</div>
              )
            })}
          </div>
        )}
      </main>

      <Popup
        visible={show}
        onMaskClick={() => setShow(false)}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '86vh', overflowY: 'auto' }}
      >
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 17, fontWeight: 600 }}>{editing ? '编辑动作' : '新建动作'}</span>
            <Button color="primary" fill="none" onClick={save}>保存</Button>
          </div>

          <div className="field">
            <label>名称</label>
            <Input value={name} onChange={setName} placeholder="如：上斜哑铃卧推" maxLength={20} />
          </div>
          <div className="field" onClick={() => setPicker('cat')}>
            <label>部位</label>
            <div className="field-val">{category}<IconChevron size={16} /></div>
          </div>
          <div className="field" onClick={() => setPicker('equip')}>
            <label>器械</label>
            <div className="field-val">{equipment}<IconChevron size={16} /></div>
          </div>
          <div className="field" onClick={() => setPicker('metric')}>
            <label>计量方式</label>
            <div className="field-val">{METRIC_LABEL[metric]}<IconChevron size={16} /></div>
          </div>
          <div className="field block">
            <label>备注</label>
            <TextArea value={note} onChange={setNote} placeholder="选填，如：注意顶峰收缩" maxLength={100} showCount rows={2} />
          </div>
        </div>
      </Popup>

      <Picker
        visible={picker === 'cat'}
        columns={[CAT_OPTIONS]}
        value={[category]}
        onClose={() => setPicker(null)}
        onConfirm={(v) => { setCategory(v[0] as Category); setPicker(null) }}
      />
      <Picker
        visible={picker === 'equip'}
        columns={[EQUIP_OPTIONS]}
        value={[equipment]}
        onClose={() => setPicker(null)}
        onConfirm={(v) => { setEquipment(v[0] as string); setPicker(null) }}
      />
      <Picker
        visible={picker === 'metric'}
        columns={[METRIC_OPTIONS]}
        value={[metric]}
        onClose={() => setPicker(null)}
        onConfirm={(v) => { setMetric(v[0] as Metric); setPicker(null) }}
      />
    </>
  )
}
