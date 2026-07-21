/**
 * Companion 数据仓库
 *
 * 抽象角色数据的持久化访问。当前实现基于 localforage (IndexedDB)，
 * 后续可替换为 SQL 实现，只需实现 ICompanionRepository 接口即可。
 *
 * 使用方式：
 *   import { companionRepo } from '@/repositories/companionRepository'
 *   const list = await companionRepo.getAll()
 */

import localforage from 'localforage'
import type { Companion } from './types'

// ── 仓库接口 ──
// 未来 SQL 实现也实现此接口即可无缝切换
export interface ICompanionRepository {
  /** 获取全部自定义角色 */
  getAll(): Promise<Companion[]>
  /** 按 ID 获取 */
  getById(id: string): Promise<Companion | null>
  /** 创建或更新（有 id 则更新） */
  save(companion: Companion): Promise<void>
  /** 删除 */
  delete(id: string): Promise<void>
  /** 当前数量 */
  count(): Promise<number>
}

// ── localforage 实现 ──

const STORE_KEY = 'custom_companions'
const store = localforage.createInstance({ name: 'coread_custom_companions' })

class LocalForageCompanionRepo implements ICompanionRepository {
  async getAll(): Promise<Companion[]> {
    const list = await store.getItem<Companion[]>(STORE_KEY)
    return list || []
  }

  async getById(id: string): Promise<Companion | null> {
    const all = await this.getAll()
    return all.find((c) => c.id === id) || null
  }

  async save(companion: Companion): Promise<void> {
    const all = await this.getAll()
    const plainCompanion = JSON.parse(JSON.stringify(companion))
    const idx = all.findIndex((c) => c.id === plainCompanion.id)
    if (idx > -1) {
      all[idx] = plainCompanion
    } else {
      all.push(plainCompanion)
    }
    await store.setItem(STORE_KEY, all)
  }

  async delete(id: string): Promise<void> {
    const all = await this.getAll()
    const filtered = all.filter((c) => c.id !== id)
    await store.setItem(STORE_KEY, filtered)
  }

  async count(): Promise<number> {
    const all = await this.getAll()
    return all.length
  }
}

// ── 工厂：未来替换为 SQL 实现 ──
// import { SqlCompanionRepo } from './sql/companionRepository'
// export const companionRepo: ICompanionRepository = new SqlCompanionRepo()

export const companionRepo: ICompanionRepository = new LocalForageCompanionRepo()
