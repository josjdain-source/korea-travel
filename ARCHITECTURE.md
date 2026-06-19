# Human Experience Graph — 설계도 (ARCHITECTURE)

> **장소를 분류하지 않는다. 사람이 어떻게 이동하고 *무엇으로 변하는지*를 저장한다.**
> (MVP명 "Experience Korea Like Creators" → "Travel Identity Network" → "Human Travel Behavior Graph" → 정체는 *Human Experience Graph*. 여행은 [행동→감성→정체성] 벡터 공간을 관측하는 *첫 번째 센서*일 뿐.)
> Recommendation(어디로) → Explanation(왜) → Query(관계) → Transition(왜 이동) → Flow(다음 어디) → **Evolution(무엇이 되나)**.
>
> **카테고리: Travel Search ❌ → Creator Experience Replication ⭕** = `Video → Intent → Journey → Action` 변환층.
> **Creator = 콘텐츠 생산자가 아니라 경험 큐레이터.** 그래서 Creator DNA가 의미를 가짐 — 사용자는 "누가 유명해?"가 아니라 "내 여행 방식과 맞는 사람은?"을 고른다.
> **목표 함수 선언:** YouTube=watch-time·retention / 우리=follow·하루완성·행동전환. 좋은 콘텐츠의 정의 자체가 다름.

> 작업폴더: `C:\Users\admin\Desktop\여행사이트`
> 형태: 백엔드 없는 **정적 사이트 MVP** (HTML + CSS + Vanilla JS + JSON 데이터)
> 최종 갱신: 2026-06-18

---

## 1. 한 줄 정의

> **여행 검색이 아니라 Travel Identity Engine.** 사용자는 여행지를 찾는 게 아니라 *자기 여행 정체성*을 발견한다. 넷플릭스가 영화를, MBTI가 성격을 "파는" 게 아니듯.

**핵심 사슬 (전부 동일 action 벡터 공간):**
```
Action → Emotion → Identity → Tribe → Creator(사례) → Place → Booking
 V13      V14        V15       V16       V11          V2~V5    V17
        └──────── 엔진 ────────┘ └──────── 네트워크 ────────┘
```
크리에이터는 *정체성의 사례*일 뿐 → 크리에이터가 사라지거나, 한국이 일본·대만으로 바뀌어도 엔진은 안 죽는다(visits만 추가). **V16부터 데이터 중심이 Creator DNA → Traveler DNA로 이동**(소속감·여행 SNS·여행 MBTI 생태계).

> 부가 정의: 전 세계 크리에이터가 한국을 *즐기는 방식*을 수집해, 누구나 그대로 따라 하게 만드는 플랫폼.

- 입구는 **장소가 아니라 경험**("뭘 해보고 싶나?": 음식·문화·자연·카페·드라마…)
- 경쟁자는 관광공사 ❌ → **유튜브·인스타** ⭕ (그들=꿈을 보여줌, 우리=꿈→실제 경험으로 변환)
- 슬로건: **"Experience Korea Like Global Creators"** / "Seen it on Instagram? We'll show you how to get there."
- 타깃: 외국인 / 지방 집중(서울·부산·제주 회피)

---

## 1.5 제품 레이어 — 보이는 것 vs Hidden Engine

> 사용자는 *이번 주말 어디 가지*를 클릭하지 *나는 무엇으로 진화하나*를 클릭하지 않는다.
> **겉: 한국 여행 추천 / 속: Human Experience Graph 수집기.** 사용자는 서비스를 쓰고, 운영자는 행동 그래프(독점 자산)를 얻는다.

| 레이어 | 무엇 | 사용자에게 |
|---|---|---|
| **User-facing** | ★크리에이터-우선 랜딩(creators→route) · Reel→Place 변환기 · 경험 랭킹 · 퀴즈 · Tribe · AI 가이드 | 그대로 노출 |
| **Hidden Engine** | Identity Graph · Query · Transition · Flow · Evolution (V20~V25) | "AI가 취향을 더 잘 이해합니다" 정도로만 |

> **입구는 사람이다 (UX 핵심).** 사람=입구 / 영상=증거 / 장소=결과. 관광식 `장소→영상`이 아니라 `크리에이터→영상→장소→가는법`. 첫 화면 = "Experience Korea Like Creators" + 피처드 크리에이터 + 루트. 경쟁자는 관광공사❌ 유튜브·틱톡·릴스⭕ — 사용자는 거기서 *여행 욕망*을 얻고, 우리는 그걸 *실행 가능한 루트*로 변환.
>
> **크리에이터-경험 데이터 모델 (타깃):** 현재 `visits[]`(creator·place·reason·videoUrl·views)는 출발점. 목표는 scene 단위:
> ```jsonc
> { "creator", "video",
>   "scene": [{ "place", "timestamp", "emotion" }],   // timestamp·emotion = 영상주석/비전 필요(미보유)
>   "route": ["서울","경주","전주"],                    // 지금도 derivable (그들의 장소)
>   "difficulty": "easy" }
> ```
> `route`/스팟/영상은 지금 `route.html`로 구현됨. `timestamp`·`emotion`은 지어내지 않고 영상 주석 단계로 둠.
>
> **엔티티 계보 (Place는 부모가 아니다):** `creator → creator_video → video_place_visit → route → user_follow`. Place가 부모가 되면 다시 관광 사이트로 회귀. 사람이 루트.
> **route.html = 핵심 제품(경험 복제 페이지).** 사용자 흐름 `유튜브에서 봄 → "저 사람 어디 갔지?" → Creator Journey → 따라가기`의 종착 = 여기. **수익(KTX·숙소·가이드 제휴)은 장소 페이지가 아니라 이 경험-복제 페이지에 붙는다.**
> **Featured ≠ 최다 조회수 = 랭킹 철학 교체.** 입구 기준이 "누가 유명한가" → "누가 사용자의 *여행 행동*을 만드는가". **유튜브와 여행 서비스는 목적 함수가 다르다**(YouTube: watch-time·retention / 우리: follow·하루완성·행동전환). `creators.js featuredScore` = reach + 장소수 + 지역스프레드 + 경험다양성. 실측: QiRanger(5만뷰·7곳·4지역·6테마)가 Mark(6.8M·식당3곳)를 제침.
> **위험(현재 MVP의 한계):** 장소수 선형 가중 → 시간이 지나면 *place-count 게임*(얕은 영상 20개 > 깊은 여행 1개). **미래 JourneyScore = Reach × RouteDepth × ExperienceDiversity × FollowConversion** (곱셈형 + 깊이/전환 포함, 장소수엔 diminishing returns). 단 `FollowConversion`은 데이터 생긴 뒤 — **지금 없는 데이터 안 넣음**(MVP는 현 방식 유지).
> **Creator DNA + User DNA → Follow Match.** 사용자DNA만으론 약함. 둘을 합치면 "비슷합니다"가 아니라 **"이 사람의 한국 5일 루트를 따라가세요."** 처음 만든 Identity/DNA/Tribe가 여기서 제자리를 찾음.

**개념 사다리는 V25에서 닫혔다.** V26+ 명명은 한계효용 급감 — 엔진은 데이터를 받을 준비 완료. 이제 가치는 *개념*이 아니라 **수집된 데이터 × 시간**에서 나온다. (keystone: `backend/schema.sql`의 `traveler_events`. 프런트는 `memory.js`가 이미 동일 이벤트를 emit 중 → 저장소만 Supabase로 교체하면 V23·V24·V25가 동시에 진짜가 됨.)

**이벤트 포착은 전 표면에서 일어난다** (`memory.js` 로드): `match`(Reel→Place, app.js) · `visit`(장소 페이지, place.js) · `guide_open`(guide.js) · `quiz`/`evolve`(quiz.js) · `save`(place.js). **단일 기기의 시간순 `visit` 이벤트 = V23/V24가 필요로 한 trip sequence의 진짜 씨앗.** UI는 교체 가능, 이 이벤트 스트림만 복제 불가 자산.

> **관심 vs 행동:** `save`/`quiz`=관심("가고 싶다"), `visit`=행동("실제 갔다"). 후자가 그래프를 *상상→관측*으로 바꾼다.
> **이벤트 품질(부족보다 오염이 먼저 온다):** 각 이벤트는 처음부터 `device_key`(영속 익명 id)·`session_id`·`event_type`·`place`·`identity_before/after`·`created_at`를 달고 나온다. `memory.js`가 **세션 내 반복 visit/guide_open을 소스에서 dedup**(새로고침 스팸 제거). device_key+session_id로 버스트 묶기·순서 복원·봇 필터가 가능 → `traveler_events`가 처음부터 깨끗하게 쌓인다.

## 1.6 데이터 관점 재정리 (축이 뒤집혔다)

초기: `장소 → 추천 → 사용자`. 현재: **`사용자 행동 → traveler_events → 그래프 → 추천`.** 사용자가 보는 모든 기능은 Layer 3지만, **진짜 자산은 Layer 0~2**.

```
Layer 0  Raw Events     quiz · match · visit · guide_open · save · evolve   (memory.js emit)
Layer 1  Clean Events   device_key·session_id·created_at + rapid-repeat dedup + (서버)봇/dedup
Layer 2  Derived Views  Transition(엣지) · Flow(확률) · Evolution(정체성변화)  ← 전부 같은 원천의 뷰
Layer 3  User Features  추천 · 랭킹 · 트라이브 · AI 가이드
```

- **관심 vs 행동 (이벤트 가중):** `visit`(실제 갔다) ≫ `save`/`quiz`(그렇게 말했다). 초기·미튜닝 가중치 `engine.EVENT_WEIGHTS`(visit 1.0 / guide_open .5 / save .3 / match .2 / quiz .1) — *숫자는 데이터로 튜닝, 지금은 방향만*. 경주 50번 저장해도 강릉만 방문하면 진짜 취향은 후자.
- **데이터 계보(Data Lineage):** 모든 파생 결과는 *어떤 이벤트로부터* 나왔는지 역추적 가능해야 한다. "왜 경주?" → "코사인 때문" ❌ → **"비슷한 행동의 4,182명 중 61%가 강릉→경주" ⭕.** `query.js` Flow 뷰가 각 확률 옆 "lineage ▾"로 *기여 레코드*를 펼쳐 보여줌(데모 데이터 위 시연, 메커니즘은 실제). 근거는 결국 `traveler_events`.

## 2. 사업 진화 사다리 (V1 → V5)

이 프로젝트는 한 번에 설계된 게 아니라, 5단계로 깊어졌다. 코드는 전부 이 사다리를 반영한다.

| 단계 | 질문 | 데이터 | 구현 위치 | 상태 |
|---|---|---|---|---|
| **V1** | 누가 갔나? | `creators[]` | `ranking.js` | ✅ |
| **V2** | 어디 갔나? | `visits[].place` (정규화) | `ranking.js` 집계 | ✅ |
| **V3** | 왜 갔나? | `visits[].reason` → theme | `themeProfile()` DNA % | ✅ |
| **V4** | 뭘 했나? | 행동 태그(`actionsOf`, 영상텍스트 파생) | `place.js` "What creators do here" · 강도=크리에이터 수 | ✅ (1차) |
| **V5** | 다음엔 어디? | DNA 코사인 유사도 | `similarPlaces()` | ✅ |
| **V6** | 행동으로 탐색 | 행동 역검색 | `ranking.html?action=` | ✅ |
| **V11** | 크리에이터는 어떤 사람? | Creator DNA + Archetype | `creators.js` + `archetypeProfile()` | ✅ |
| **V12** | 나는 어떤 여행자? | Traveler DNA 퀴즈(행동기반) → 크리에이터·장소 AI 매칭 | `quiz.js` (action 벡터 + cosine) | ✅ |
| **V13** | 어떻게 즐기나? | **Action 벡터 = 공유 벡터공간** | `engine.actionVector()` | ✅ |
| **V14** | 왜? (감성) | action → Emotion DNA | `engine.emotionProfile()` | ✅ |
| **V15** | 나는 누구인가? | 명명된 Traveler Identity | `engine.identityOf()` | ✅ |
| **V16** | 나는 어디 속하나? | Tribe (정체성별 멤버 + 트라이브 동선) | `tribe.js` | ✅ (크리에이터) |
| **V16.5** | 우리 부족은 뭘 했나? | Tribe Memory (여행자가 데이터 추가) | `memory.js` (localStorage 시연) | ✅ (기기 한정) |
| **V16.8** | 새 부족이 생기나? | Emerging Tribes (행동 클러스터링) | `engine.discoverTribes()` | ✅ (시드 시연) |
| **V18** | 실데이터 수집 | **Supabase 라이브** (traveler_events 적재·집계) | `supabase.js`+`live.html` | ✅ LIVE |
| **V17/19** | 수익/플라이휠 | Booking · Flywheel | — | ⏳ |

> **백엔드 LIVE (V18).** Supabase 프로젝트 `nmzngmmaxcqrtdryubsd`에 `travelers`/`traveler_events`/`traveler_saves`/`traveler_ratings` 생성. RLS: anon은 INSERT만(공개 텔레메트리), 원시행 SELECT 차단, 집계는 SECURITY DEFINER RPC(`rr_events_count`/`rr_events_breakdown`/`rr_recent_flow`)로만. `memory.js`가 모든 이벤트를 localStorage(미러)+Supabase에 적재. `live.html`이 실시간 readout. **검증: insert 201, raw select 차단, visit 2건→`rr_recent_flow`가 실제 전이 산출.** 보안 트레이드오프(permissive insert=스팸 가능)는 의도된 공개수집, Tier-2(서버 정제·rate limit)로 보완 예정.
| **V20** | 어느 나라든? | Identity Graph (국가-무관 매칭) | `graph.js` + `places_intl.json` | ✅ (시연) |
| **V21** | 왜 추천됐나? | Graph Explorer (매칭 경로 추적) | `engine.sharedDimensions()` + graph "why?" | ✅ |
| **V22** | 그래프에 질의 | Graph Query (관계 질의) | `query.js` | ✅ |
| **V23** | 왜 이동했나? | Transition Graph (Node→Edge, 인과) | `query.js` "connect" (무방향 시연) | ⏳ 방향/인과는 backend |
| **V24** | 다음에 어디로? | Flow Graph (확률 전이 = Simulator) | `engine.flowMatrix()` + `query.js` "flow" | ⏳ illustrative 시연 |
| **V25** | 무엇이 되나? | Identity Evolution (Identity→Identity') | `flowMatrix`(identity 쌍) + `query.js` "evolve" | ⏳ illustrative 시연 |
| **V26** | 장소가 사람을 바꾸나? | Human Behavior Simulator | *종단 데이터 필요* | ⏳ backend |

> **질문이 바뀐다: "어디로 가나" → "무엇으로 변하나".** V25는 `Identity(t) → Experience → Identity(t+1)` — 예: Street Flavor Hunter →(군산·전주)→ Heritage Romantic. 장소 추천이 목적이 아니라 **장소가 사람을 어떻게 바꾸는가**가 목적. 성장 경로(여행판 RPG 스킬트리).
> **구현 절약:** Identity 진화 = `flowMatrix`를 (before→after) 쌍에 적용 — 새 엔진 불필요(코드 재사용).
> **정직성:** V25는 V24보다 강한 블로커 — 종단 기록 `(traveler_id, identity_before, visit, identity_after, ts)`가 0개. 데모는 **`identity_evolution_demo.json`(invented)**. 숫자 가짜, 메커니즘 진짜.

> **Cosine(가까움) → Edge(연결됨) → Flow(흐름).** V24는 그래프를 *상태 머신*으로: `P(next place | current, identity)`. "강릉 방문 후 → 62% 경주 / 21% 전주 / 11% 보성 / 6% 이탈" 같은 **확률 전이 행렬** → 엔진이 "어디가 좋나"가 아니라 **"이 사람이 다음에 어디로 흐를까"**를 답함 = Behavior **Simulator**.
> **정직성:** 실제 흐름 확률은 다수의 *순서 있는* 여행 시퀀스 필요 — 없음. `flowMatrix()`는 진짜 코드지만, 데모는 **`trips_demo.json`(명시적 invented/illustrative)** 으로 메커니즘만. 숫자는 가짜, 메커니즘은 진짜. 진짜 흐름 = 순서 데이터 + 규모 = backend(V18).

> **Node Graph → Causal Graph (V23).** V22까지는 점(사람·장소·크리에이터·트라이브)의 세계. V23은 *전이*를 저장: `Quiet Horizon Wanderer → 일출선호 → 강릉 → 전통거리 → 경주`. "왜 같은 부족도 일부는 경주, 일부는 전주로 갈라지나"를 본다.
> **정직성:** 방향성·인과 전이(A→B)는 **여행 순서/타임스탬프**가 있어야 한다 — 현재 데이터엔 없음. 지금은 `query.js` "connect"가 **무방향 공동방문 엣지 + 엣지 설명(공유 행동 차원)**만 시연. 방향·인과 = V18 backend.
> **전이 데이터 모델 (추가 필요):** `visits`에 `trip_id` + `seq`(또는 `visited_at`) → 전이 = `(from_place, to_place, traveler/creator, identity, context)`. 그러면 인과 엣지가 데이터에서 떨어진다.

> **Recommendation → Explanation → Query.** V22는 벡터 공간을 *질의 가능*하게 만든다: "이 정체성에 가장 가까운 크리에이터?", "X를 방문한 사람들이 함께 간 곳?", "나는 A와 B 중 누구에 더 가깝나?" — 단발 추천이 아니라 노드 간 관계 탐색. **모든 게 한 좌표계라 가능.**
> 정직성: "함께 방문(also-visited)"은 *연관*이지 시간순 "다음에 갔다"가 아님. 시계열 "next"·최근성은 timestamped 여행자 데이터(backend, V18) 필요.

> **V21 = 추천기 → 행동 지도(Behavior Map).** 추천 장소를 펼치면 경로를 역추적: `Identity → Emotion → 공유 Action → Place`. 매칭을 만든 *실제 공유 차원*을 보여줌 → 블랙박스 아님. 모든 노드(사람·장소·크리에이터·트라이브)가 같은 좌표계라 어떤 두 점이든 "왜 가까운가"를 설명 가능.

> **장소는 좌표일 뿐.** identity 벡터는 국가를 안 가린다 — 장소를 action 프로필로 태깅하면 같은 엔진이 한국·일본·대만 어디서든 매칭. 실측: Quiet Horizon Wanderer → 🇰🇷통영·강릉 / 🇯🇵가마쿠라·오노미치 / 🇹🇼화롄. Street Flavor Hunter → 🇰🇷군산 수산시장 98% / 🇹🇼타이난 98%.
> 한국 = 실제 크리에이터 방문, 해외 = **illustrative 수동 프로필**(엔진의 국가-무관성 시연용, 검증 데이터 아님).
> **최대 자산 = [행동→감성→정체성] 3층을 한 벡터 공간으로 통일한 것.** 그 덕에 Creator·Traveler·Place·Tribe가 한 좌표계에서 움직이고, 국가가 100개로 늘어도 엔진은 그대로. cosine()도 quiz.html도 "Hidden Path Explorer"라는 이름도 아닌, *이 통일된 좌표계*가 본질.

> **Top-Down vs Bottom-Up.** V15 IDENTITIES는 우리가 명명("Street Flavor Hunter"). V16.8은 여행자 행동 벡터를 **클러스터링해 부족을 발견** — "Heritage Cafe Wanderers"는 아무도 안 지었고 데이터에서 떨어진다. 관광청은 *장소*를 보고 우리는 *행동*을 본다 → 복제 불가 자산.
> 현재 `discoverTribes()`를 시드(크리에이터 8)에 돌리면 "Nature Heritage Wanderers" 등 창발 — 작은 데이터라 거칠다. 진짜 창발은 수천 Traveler Memory에서. **그래서 우선순위: V16.5/V16.8(독점 데이터) > V17(수익). 수익은 나중에도 붙지만 1만 명의 행동 그래프는 복제 불가.**

> **데이터 흐름 역전 (V16.5의 핵심).** 분류 엔진은 `Action→Emotion→Identity→Tribe`로 *내려가지만*, 실서비스 사용자는 `Traveler→Tribe→…→Place`로 *올라온다* ("나 같은 사람은 어디 갔나?"). 그래서 V16.5부터 데이터 중심이 Creator→Traveler로 이동, **크리에이터는 씨앗·여행자가 숲.**
> 현재 `memory.js`는 이 역전을 **localStorage로 시연**(여행자가 장소를 tribe에 저장). "4,182명·경주 +18%(30일)" 같은 풀링·시계열 통계는 backend가 모은 실데이터로만 — 절대 안 지어냄.

### V16.5 backend 스키마 (규모 작음)
```sql
travelers       (id, identity, created_at)
traveler_saves  (traveler_id, place, identity, created_at)   -- "어디 갔/가고싶나"
traveler_ratings(traveler_id, place, follow_ease, transport, photo, satisfaction, created_at)
```
이것만 쌓이면 자동 생성: *"Hidden Path Explorer가 올해 가장 좋아한 곳 TOP10"*, *"Quiet Horizon Wanderer 최근 30일 보성 +22%"* — **관광청도 못 가진 "성향×이유" 데이터.** Supabase(이미 연결됨)가 자연스러운 선택.

> **엔진 ↔ 네트워크 분기점은 V16.** V13~V15는 정적 데이터로 완결되는 *엔진*(분류 체계). V16 Tribe부터는 여행자 멤버십·예약·피드백이 쌓이는 *네트워크*라 **backend/persistence가 필요**하다. 현재 트라이브 멤버 = 분류된 크리에이터(실측). 여행자 멤버 카운트("전 세계 N명")는 퀴즈 결과 서버 저장 후 — 지어내지 않음.
> 실측 트라이브 동선: Quiet Horizon Wanderer(cari·Next Stop) → 강릉·보성·여수 / Street Flavor Hunter(Mark) → 전주·군산·장수.
> **수익도 트라이브에서**: "Hidden Path Explorer 추천 코스", "Street Flavor Hunter 맛집 패키지" — Place 단위 예약보다 강한 번들.

> **벡터 공간 통일이 핵심.** Place DNA·Creator DNA·Traveler DNA(퀴즈)가 전부 **동일한 action 라벨 벡터**라서 `cosine()` 하나로 셋이 연결된다. 그래서 퀴즈 질문도 "좋아하는 장소"❌ "여행 가서 뭘 하나"⭕ 로 설계 — 같은 차원에 떨어지게.
> 실측: 음식형 여행자 → Mark Wiens 94%(감성 Discovery) · 힐링형 → Next Stop Korea 85%(감성 Healing).
> **AI 시대 해자:** 전주 위치·KTX 시간표는 누구나 복제. 하지만 *100 크리에이터 → 행동 → 감성 → 여행자 벡터*는 직접 모아야 함 = 진짜 자산.

> 핵심 통찰들:
> - **장소는 복사 못 해도 행동 패턴은 타지역에 적용된다** → V5 추천엔진 성립(여행 넷플릭스). 예: 강릉 → 보성·담양 89%.
> - **장소→행동→감성→인물.** 사람은 "어디 갔나"가 아니라 *그 사람이 세상을 보는 방식*에 끌린다 → Creator DNA(V11).
> - **크리에이터는 바뀌어도 감성(Archetype)은 안 변한다** → Archetype을 매칭 축으로(V12). 입구가 "어디 갈까?"가 아니라 **"당신은 어떤 여행자인가?"**.
> - 실측 Creator DNA: Mark Wiens=Food Hunter 🍜(100%), Drew Binsky=Explorer 🧭, cari cakes=Healing Wanderer 🌿.

---

## 3. 컴포넌트 지도 (파일 = 책임)

```
여행사이트/
├── engine.js                        ★ 공용 두뇌: 테마·행동 vocab + 점수/DNA/유사/archetype
├── ranking.html / ranking.js        ★ 메인 입구: 경험 선택 → 장소 랭킹 (+행동 역검색)
├── place.html   / place.js          장소 상세: 크리에이터·영상·DNA·행동·유사·가는법
├── index.html   / creators.js       ★홈(/): 크리에이터 여정 랜딩 = 피처드+영상카드(실YT썸네일)→루트
├── find.html    / app.js            영상→장소 변환기 + 촬영지 카탈로그 (구 index, 이제 보조)
├── creators.html                    → index.html 리다이렉트 (구 링크 보존)
├── route.html   / route.js          크리에이터 루트: 출처영상 히어로 + 스팟(▶영상·가는법) (사람→영상→장소)
├── quiz.html    / quiz.js           Traveler DNA: 행동기반 퀴즈 → Identity + 매칭 (V12·V15)
├── tribe.html   / tribe.js          Tribe: 멤버 + 동선 (V16) + Emerging Tribes 발견 (V16.8)
├── graph.html   / graph.js          Identity Graph: 국가-무관 매칭 (V20) + 경로추적 (V21)
├── query.html   / query.js          Graph Query: 관계 질의 (V22)
├── memory.js                        이벤트 척추: localStorage 미러 + Supabase 적재 (V16.5/V18)
├── supabase.js                      Supabase REST 클라이언트 (insert + 집계 RPC)
├── live.html    / live.js           라이브 그래프 readout (실제 Supabase 집계) (V18)
├── styles.css                       공용 스타일 (라이트/워밍 테마)
├── data/
│   ├── visits.json                  ★ 핵심 자산: creators[8] + visits[33] (한국, 실측)
│   ├── locations.json               드라마/영화 촬영지[12]
│   └── places_intl.json             해외 장소 프로필 (illustrative, V20 시연용)
└── pipeline/
    ├── ingest.mjs                   "레이더" 자동수집 스켈레톤 (오프라인 실행)
    ├── place_aliases.json           정규화 가제티어 (같은 곳 → 한 이름)
    └── ingested.candidates.json     수집 후보 (사람 검증 대기)
```

> **`engine.js`가 단일 진실원천(single source of truth).** 테마/행동 어휘와 점수·DNA·코사인·archetype 함수가 전부 여기 있고, `ranking.js`/`place.js`/`creators.js`가 공유한다(중복 금지). 페이지 스크립트보다 먼저 로드.

### 페이지별 흐름

```
[ranking.html]  경험 칩 선택 → 장소 랭킹 ─┐
                                          ├─ 행 클릭 ─→ [place.html?place=…]
                                          │              크리에이터/영상/DNA/유사
                                          └─ "Find the place" 링크 ─→ [index.html]

[find.html]  영상 링크·설명 붙여넣기 → matchContent() → 장소 매칭 → 지도/장소
```

> **자체 AI 챗 가이드는 제거됨(결정).** 사람들은 이미 자기 폰의 ChatGPT/Gemini가 있다 → 우리 강점은 챗봇이 아니라 *구조화된 "누가·왜·어디·가는 법" 정보*. guide.html/guide.js/guide.css + 현장 QR 삭제. (로컬 규칙엔진 answerLocally는 데모 비계였고 같이 폐기.)

---

## 4. 데이터 모델

### 4-1. `data/visits.json` (핵심 자산)

```jsonc
{
  "creators": [
    { "id", "name", "country", "platform", "handle",
      "subscribers", "subscribersAsOf", "url", "sources":[] }
  ],
  "visits": [
    { "creatorId",          // → creators[].id
      "place",              // ★ 정규화된 표준 장소명 (집계 키)
      "city", "region",     // 행정 단위
      "spot",               // 크리에이터가 적은 원문 (표시용)
      "views",              // 근사치
      "reason",             // 자유 텍스트 → theme으로 매핑됨 (V3)
      "videoUrl",           // 실제 영상 (place 페이지 "쇼츠 모음")
      "confidence",         // high | medium | low
      "sources":[] }
  ]
}
```

**정규화(normalization)가 데이터 품질의 핵심.** 크리에이터마다 같은 곳을 다르게 적는다
("Jeonju Hanok area" / "Jeonju Hanok Village" / "Hanok Village, tea houses, cafes")
→ 전부 `place: "Jeonju Hanok Village"` 로 통일해야 크리에이터 카운트가 합쳐진다.
반대로 **다른 곳은 안 묶는다**(담양 죽녹원 ≠ 대나무골 — 다른 공원).

### 4-2. `data/locations.json` (촬영지)

```jsonc
{ "id", "nameEn", "nameKo", "city","cityKo","region",
  "category":"drama|movie", "titles":[{titleEn,titleKo,year}],
  "description", "gettingThere", "nearby":[],
  "lat","lng", "confidence", "sources":[],
  // 재현 레이어:
  "whyFamous", "photoTip", "bestTime", "difficulty",
  "visits":[]   // 검증된 크리에이터 추천만 (없으면 빈 배열)
}
```

---

## 5. 핵심 엔진 (알고리즘)

| 엔진 | 위치 | 하는 일 |
|---|---|---|
| **랭킹 점수** | `ranking.js aggregate()` | `creatorCount × 1e9 + totalViews`. 크리에이터 수가 **주**, 조회수는 **동점 처리**(메가 크리에이터 1명이 순위 지배 못 함) |
| **theme 매핑** | `themesOf()` | 자유 텍스트 reason → 표준 테마(Food/Culture/Nature/Cafe/K-Drama/History/Local Life) |
| **Place DNA** | `profileOf()` + `dnaPercent()` | 장소의 방문 이유 분포 % (V3) |
| **유사 추천** | `cosine()` + `similarPlaces()` | DNA 벡터 코사인 유사도 > 0.3 상위 3곳 (V5) |
| **영상→장소** | `app.js matchContent()` | 붙여넣은 텍스트/링크를 알려진 장소와 키워드 매칭 |
| **장소 AI** | `guide.js answerLocally()` | 그 장소 데이터만으로 질문 응답 (로컬 RAG) |

---

## 6. 교체 지점 (현재 stub → 실제 서비스)

API 키 없이 지금 돌아가도록 **stub**으로 만든 부분. 실서비스 전환 시 이 함수들만 교체:

| 함수 | 현재 (MVP) | 실서비스 |
|---|---|---|
| `app.js matchContent()` | 키워드 매칭 | 영상 이해 LLM (URL → 장소 특정) |
| `guide.js generateAnswer()` | `answerLocally()` 로컬 RAG | Claude/GPT/Gemini API 호출 (context = 장소 데이터) |
| `pipeline/ingest.mjs fetchRecentVideos()` | 샘플 데이터 | YouTube Data API |
| `pipeline/ingest.mjs extractPlaces()` | 텍스트 alias 스캔 | LLM(제목+자막) → 최종 프레임 비전 분석 |

> 즉 **배관은 얇고(easy), 어려운 건 ① 어떤 채널을 추적할지(큐레이션=moat) ② 장소 추출 정확도(정규화)** — 이게 프로젝트의 본체.

---

## 7. 정직성 원칙 (제품 신뢰의 핵심)

이 데이터의 가치는 100% **진짜냐**에 달렸다. 코드/데이터에 강제된 규칙:

1. **크리에이터·조회수·추천을 지어내지 않는다.** 검증된 출처만. 없으면 빈 배열 + AI가 "확인된 기록 없음"이라 답함.
2. **스탯은 실제 계산값만.** "1,247명" 같은 목표치 대신 실제(8명)를 "(seed — growing)"으로 표시.
3. **별점은 데이터로 못 받치면 안 보여준다.** 4차원(따라가기 쉬움·교통·사진 재현도·만족도) 구조만 두고 "방문자 피드백 후 공개".
4. **자동 수집분은 confidence=low → 사람 검증 후 승격.** 모르는 장소는 추측 안 하고 리뷰 큐로.
5. **범위 편집은 정직하게.** 예: 평양(북한) 방문은 관광 맥락 아님 → 제외.
6. **데이터가 발견한 구조 > 우리가 붙인 이름 (Bottom-Up > Top-Down).** "Street Flavor Hunter"는 사람이 지은 V15 이름일 뿐 — 1만·10만 로그가 쌓이면 클러스터(V16.8)는 예상과 다르게 나올 수 있다. **창발 부족(V16.8)을 명명 정체성(V15)보다 높은 권위로 둔다.** V15는 콜드스타트용 비계(scaffold)고, 진실은 데이터가 정한다. Identity를 과신하지 말 것.

---

## 8. 현재 데이터 규모 (2026-06-18)

- 크리에이터 **8명** (Drew Binsky, Mark Wiens, cari cakes, Dasha Taran, Samuel and Audrey, QiRanger, Adrienne Hill, Next Stop: Korea)
- 검증 방문기록 **33건** / 촬영지 **12곳**
- 장소 랭킹 TOP: 1 전주 한옥마을(4) · 2 경주 역사지구(4) · 3 강릉(3) — **서울 11위·부산 14위**

---

## 9. 로드맵 (다음 = 기술 아닌 데이터/루프)

1. **추적 크리에이터 8 → 100명+** (큐레이션, API 불필요) — Creator DNA·랭킹 정밀화의 본체
2. **수집 파이프라인 가동** — `ingest.mjs`의 3개 stub 교체, 정규화 가제티어 확장
3. **V4 행동 태깅 고도화** — 현재는 영상 텍스트 파생(1차). 영상 분석으로 정밀화 → "따라하기" 타임라인 근거
4. **감성/행동 벡터 정밀화** — 행동·감성 어휘 확장, 영상 단위 태깅으로 벡터 해상도↑ (V13/V14 데이터 깊이)
5. **V17 Booking (수익)** — 트라이브 패키지("Hidden Path Explorer 코스") + Place 단위 KTX·숙소·투어 제휴
6. **V18 Feedback** — 여행자 멤버십 저장(backend) + 4차원 별점(따라가기·교통·사진재현·만족도)
7. **V19 Flywheel** — 여행자↑ → Traveler DNA↑ → 매칭·트라이브 정밀화 → 더 많은 여행자. **이때 자산은 장소·크리에이터가 아니라 [행동→감성→정체성] 분류 체계** — 일본·대만·태국으로 그대로 복제.

> 수익은 정보가 아니라 **거래 핸드오프**에서 난다. 정보는 미끼.
