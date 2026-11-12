import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AudioProduct,
  CableConnection,
  ProjectMeta,
  RoomConfig,
  SpeakerPlacement,
  SystemNode,
} from '../types/audio';
import { DEFAULT_AUDIO_CATALOG } from '../data/defaultCatalog';

const STORAGE_KEYS = {
  CATALOG: 'audiocad_catalog_v3',
  CURRENT_PROJECT: 'audiocad_current_project_v3',
  SAVED_PROJECTS: 'audiocad_saved_projects_v3',
  SUPABASE_CONFIG: 'audiocad_supabase_config_v1',
};

export interface SavedProjectPayload {
  meta: ProjectMeta;
  room: RoomConfig;
  nodes: SystemNode[];
  connections: CableConnection[];
  placements: SpeakerPlacement[];
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  enabled: boolean;
}

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseConfig(): SupabaseConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SUPABASE_CONFIG);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    enabled: Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY),
  };
}

export function saveSupabaseConfig(cfg: SupabaseConfig): void {
  localStorage.setItem(STORAGE_KEYS.SUPABASE_CONFIG, JSON.stringify(cfg));
  supabaseClient = null;
}

export function getSupabaseClient(): SupabaseClient | null {
  const cfg = getSupabaseConfig();
  if (!cfg.enabled || !cfg.url || !cfg.anonKey) return null;
  if (!supabaseClient) {
    try {
      supabaseClient = createClient(cfg.url, cfg.anonKey);
    } catch {
      return null;
    }
  }
  return supabaseClient;
}

export function loadLocalCatalog(): AudioProduct[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CATALOG);
    if (raw) {
      const parsed = JSON.parse(raw) as AudioProduct[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const customItems = parsed.filter(
          (p) => p.id.startsWith('custom-') || p.id.startsWith('csv-')
        );
        return [...customItems, ...DEFAULT_AUDIO_CATALOG];
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_AUDIO_CATALOG;
}

export function saveLocalCatalog(catalog: AudioProduct[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(catalog));
  } catch {
    // ignore quota errors
  }
}

export async function syncCatalogWithCloud(
  localCatalog: AudioProduct[]
): Promise<{ catalog: AudioProduct[]; synced: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    saveLocalCatalog(localCatalog);
    return {
      catalog: localCatalog,
      synced: false,
      message: '로컬 브라우저 DB에 저장됨 (클라우드 미연결)',
    };
  }

  try {
    const { data, error } = await client.from('audiocad_products').select('payload');
    if (error) throw error;

    const cloudProducts: AudioProduct[] = (data || []).map((row: { payload: AudioProduct }) => row.payload);
    const mergedMap = new Map<string, AudioProduct>();
    DEFAULT_AUDIO_CATALOG.forEach((p) => mergedMap.set(p.id, p));
    cloudProducts.forEach((p) => mergedMap.set(p.id, p));
    localCatalog.forEach((p) => mergedMap.set(p.id, p));

    const merged = Array.from(mergedMap.values());
    saveLocalCatalog(merged);

    // Upsert merged items to cloud
    const rows = merged.map((p) => ({
      id: p.id,
      brand: p.brand,
      model: p.model,
      category: p.category,
      payload: p,
      updated_at: new Date().toISOString(),
    }));
    await client.from('audiocad_products').upsert(rows, { onConflict: 'id' });

    return {
      catalog: merged,
      synced: true,
      message: `클라우드 DB 동기화 완료 (총 ${merged.length}종)`,
    };
  } catch (err: unknown) {
    saveLocalCatalog(localCatalog);
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    return {
      catalog: localCatalog,
      synced: false,
      message: `로컬 저장 완료 (클라우드 동기화 대기: ${msg})`,
    };
  }
}

export async function saveProjectToStorage(
  project: SavedProjectPayload
): Promise<{ synced: boolean; message: string }> {
  try {
    localStorage.setItem(STORAGE_KEYS.CURRENT_PROJECT, JSON.stringify(project));
    const listRaw = localStorage.getItem(STORAGE_KEYS.SAVED_PROJECTS);
    const list: SavedProjectPayload[] = listRaw ? JSON.parse(listRaw) : [];
    const idx = list.findIndex((p) => p.meta.id === project.meta.id);
    if (idx >= 0) list[idx] = project;
    else list.unshift(project);
    localStorage.setItem(STORAGE_KEYS.SAVED_PROJECTS, JSON.stringify(list.slice(0, 30)));
  } catch {
    // ignore
  }

  const client = getSupabaseClient();
  if (!client) {
    return { synced: false, message: '브라우저에 프로젝트가 자동저장되었습니다.' };
  }

  try {
    const { error } = await client.from('audiocad_projects').upsert(
      {
        id: project.meta.id,
        project_name: project.meta.projectName,
        client_name: project.meta.clientName,
        payload: project,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) throw error;
    return { synced: true, message: '클라우드 DB 및 로컬에 프로젝트 저장 완료' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '오류';
    return { synced: false, message: `로컬 저장 완료 (클라우드 오류: ${msg})` };
  }
}

export function loadSavedProjectsList(): SavedProjectPayload[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_PROJECTS);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

export const SUPABASE_SCHEMA_SQL = `-- Supabase SQL Editor에서 실행하면 클라우드 동기화 테이블이 생성됩니다.
create table if not exists public.audiocad_products (
  id text primary key,
  brand text not null,
  model text not null,
  category text not null,
  payload jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists public.audiocad_projects (
  id text primary key,
  project_name text not null,
  client_name text,
  payload jsonb not null,
  updated_at timestamptz default now()
);

alter table public.audiocad_products enable row level security;
alter table public.audiocad_projects enable row level security;

create policy "Allow public read/write products" on public.audiocad_products
  for all using (true) with check (true);

create policy "Allow public read/write projects" on public.audiocad_projects
  for all using (true) with check (true);`;
