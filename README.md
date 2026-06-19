# Experience Korea Like Creators Do

전 세계 크리에이터가 한국을 *즐기는 방식*을 수집해, 외국인이 그대로 따라 하게 만드는 플랫폼 (MVP).
관광지 소개가 아니라 **"누가 / 왜 / 뭘 했나 / 다음엔 어디"** 를 연결한다.

> 설계·데이터모델·로드맵 전체는 **[ARCHITECTURE.md](ARCHITECTURE.md)** 참조.

## 실행

백엔드 없음. 정적 파일이라 아무 정적 서버로 열면 된다.

```bash
cd "C:/Users/admin/Desktop/여행사이트"
python -m http.server 8088
```

- 메인(경험→랭킹):  http://localhost:8088/ranking.html
- 영상→장소 변환기:  http://localhost:8088/index.html
- 장소 AI 가이드(QR): http://localhost:8088/guide.html?id=hahoe-folk-village

> QR 스캔 테스트는 같은 와이파이의 폰에서 `http://<PC_IP>:8088` 로 접속.

## 데이터 수집 스켈레톤 (오프라인)

```bash
node pipeline/ingest.mjs
```
추적 크리에이터 → (stub)영상 수집 → 장소 추출 → 정규화 → `pipeline/ingested.candidates.json`.
실제 수집은 `fetchRecentVideos` / `extractPlaces` stub을 YouTube API·LLM으로 교체.

## 데이터 추가 방법

- **크리에이터 방문**: `data/visits.json` 의 `creators[]` / `visits[]` 에 추가. `place` 는 표준명으로 정규화.
- **촬영지**: `data/locations.json` 에 추가.
- 모든 추가는 **실제 출처 확인된 것만** (ARCHITECTURE.md §7 정직성 원칙).

## 페이지

| 파일 | 역할 |
|---|---|
| `ranking.html` / `.js` | 경험 선택 → 장소 랭킹 (메인) |
| `place.html` / `.js` | 장소 상세 (크리에이터·영상·DNA·유사) |
| `index.html` / `app.js` | 영상 링크 → 장소 변환기 |
| `guide.html` / `guide.js` | QR 장소 전용 AI 가이드 |
