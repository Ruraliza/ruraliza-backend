// Trilhas de demonstração do seed: duas publicadas e uma em rascunho, do tutor de teste.
// As aulas são só de texto (os tutores adicionam os vídeos do YouTube/Vimeo pelo editor).
import type { Lesson, TrackModule, TrackRecord } from '#modules/tracks';
import type { Repositories } from './repositories';

type DemoLesson = Omit<Lesson, 'id' | 'video_url'>;
type DemoTrack = Pick<TrackRecord, 'title' | 'description' | 'categories' | 'status'> & { modules: { title: string; lessons: DemoLesson[] }[] };

const DEMO_TRACKS: DemoTrack[] = [
  {
    title: 'Colheita de café do pé à saca',
    description: 'Aprenda a reconhecer o ponto de colheita, colher sem machucar a planta e cuidar do grão até a secagem.',
    categories: ['Colheita'],
    status: 'published',
    modules: [
      {
        title: 'Antes de colher',
        lessons: [
          {
            title: 'O ponto certo do grão',
            duration_minutes: 15,
            content: '## Cereja é o ponto\n\nColha quando a maior parte dos frutos estiver **vermelha ou amarela** (cereja).\n\n- Verde: ainda não amadureceu e derruba a qualidade.\n- Seco no pé (passa): passou do ponto, mas ainda pode ser aproveitado.\n\nUma boa regra é começar quando **80%** dos frutos estiverem cereja.'
          },
          {
            title: 'Equipamentos e segurança',
            duration_minutes: 10,
            content: '## O que levar\n\n- Luvas e chapéu\n- Pano ou lona para a derriça\n- Peneira e balaio\n- Água e protetor solar\n\nUse **botina** e calça comprida: o terreno é irregular e há risco de cobras.'
          }
        ]
      },
      {
        title: 'Na lavoura',
        lessons: [
          {
            title: 'Derriça no pano',
            duration_minutes: 20,
            content: '## Passo a passo\n\n1. Estenda o pano embaixo da planta, dos dois lados.\n2. Puxe os frutos do ramo de dentro para fora, sem arrancar folhas.\n3. Abane na peneira para tirar folhas e paus.\n\nNunca quebre os ramos: eles produzem a safra do ano que vem.'
          },
          {
            title: 'Do terreiro à tulha',
            duration_minutes: 25,
            content: '## Secagem\n\nEspalhe o café no terreiro em camadas finas e **revolva várias vezes ao dia**.\n\nÀ noite, junte em leiras e cubra. O café está seco quando os grãos chacoalham dentro da casca.'
          }
        ]
      }
    ]
  },
  {
    title: 'Trator na prática: operação segura',
    description: 'Checagem diária, partida, engate de implementos e as regras da NR-31 para operar trator sem acidentes.',
    categories: ['Operação de máquinas', 'Plantio'],
    status: 'published',
    modules: [
      {
        title: 'Checagem e partida',
        lessons: [
          {
            title: 'Checagem diária',
            duration_minutes: 15,
            content: '## Antes de ligar\n\n- Nível de óleo do motor e do hidráulico\n- Água do radiador\n- Pressão e estado dos pneus\n- Freios e luzes\n\nAnote qualquer problema e avise o responsável **antes** de sair.'
          },
          {
            title: 'Partida e primeiros metros',
            duration_minutes: 10,
            content: '## Partida segura\n\nSente no banco, coloque o **cinto** e confira se a alavanca está em neutro. Só então dê a partida.\n\nNunca dê partida pelo lado de fora do trator.'
          }
        ]
      },
      {
        title: 'Implementos',
        lessons: [
          {
            title: 'Engate no três pontos',
            duration_minutes: 20,
            content: '## Engate\n\n1. Encoste o trator em marcha lenta.\n2. Desligue e puxe o freio de mão antes de descer.\n3. Engate os braços inferiores e depois o terceiro ponto.\n\nNinguém deve ficar entre o trator e o implemento durante a manobra.'
          }
        ]
      }
    ]
  },
  {
    title: 'Manejo de gado: vacinação',
    description: 'Calendário, conservação das vacinas e contenção dos animais no curral.',
    categories: ['Manejo de gado'],
    status: 'draft',
    modules: [{ title: 'Calendário', lessons: [{ title: 'Aftosa e brucelose', duration_minutes: 15, content: 'Em construção.' }] }]
  }
];

export async function seedTracks(repos: Repositories, now: string, tutorId: number, workerId: number): Promise<void> {
  for (const demo of DEMO_TRACKS) {
    let lastId = 0;
    const modules: TrackModule[] = demo.modules.map((m) => ({
      id: (lastId += 1),
      title: m.title,
      lessons: m.lessons.map((l) => ({ id: (lastId += 1), video_url: null, ...l }))
    }));
    const track = await repos.tracks.create({
      title: demo.title,
      description: demo.description,
      categories: demo.categories,
      tutor_ids: [tutorId],
      status: demo.status,
      modules,
      last_item_id: lastId,
      created_by: tutorId,
      insertion_date: now,
      updated_at: now,
      published_at: demo.status === 'published' ? now : null
    });

    // O trabalhador de teste já começou a trilha de café (concluiu o primeiro módulo).
    if (track.id === 1) {
      const firstModule = modules[0]?.lessons.map((l) => l.id) ?? [];
      await repos.enrollments.create({
        track_id: track.id,
        worker_id: workerId,
        completed_lesson_ids: firstModule,
        last_lesson_id: firstModule.at(-1) ?? null,
        started_at: now,
        completed_at: null
      });
    }
  }
}
