# PokeHaven Frontier 런처 — 설계 문서

작성일: 2026-06-16

## 1. 개요

PokeHaven Frontier 서버 전용 마인크래프트 런처. 서버가 사용하는 모드팩(NeoForge 1.21.1 / Pixelmon, 약 57개 모드)을 플레이어 PC에 설치·실행하고, 서버가 모드팩을 갱신하면 런처가 이를 감지해 **PLAY ↔ UPDATE 버튼이 자동 전환**되어 바뀐 파일만 동기화한다.

- **대상 플랫폼:** Windows x64, Apple Silicon macOS (arm64)
- **기술 스택:** Electron + TypeScript + 웹 프론트엔드
- **배포 모델:** 서버 플레이어 커뮤니티 대상 배포

### v1 기능 범위
- Microsoft 계정 로그인 (마인크래프트 인증)
- 모드팩 설치 및 게임 실행
- 자동 업데이트 (PLAY ↔ UPDATE 자동 전환, 바뀐 파일만 동기화)
- RAM 할당 조절
- 파일 검증/복구
- 서버 바로 접속 (실행 시 자동 입장)

범위 외(v1): 서버 공지/뉴스 패널, 다중 프로필, 다중 모드팩.

## 2. 주요 결정 사항 및 근거

| 항목 | 결정 | 근거 |
|---|---|---|
| 호스팅 / 원본 | GitHub (manifest는 repo, 큰 파일은 Releases) | 무료, 서버 운영 불필요. manifest의 `url`은 파일별 지정이라 추후 호스트 교체 자유 |
| 기술 스택 | Electron + TypeScript | Windows/Apple Silicon 동시 지원, 디자인 자유도, 검증된 라이브러리 생태계 |
| 런처 코어 | `@xmcl/core` + `@xmcl/installer` | NeoForge 설치를 실제 지원하고 활발히 관리됨 (minecraft-launcher-core는 NeoForge 설치 미지원 + 사실상 유지보수 중단이라 채택하지 않음) |
| 인증 | 자체 Azure 애플리케이션 Client ID + msmc, raw OAuth 폴백 | 정식·무료. msmc 단일 의존 리스크에 대비해 폴백 확보 |
| 모드 jar 배포 | 풀 자체 호스팅 (Pixelmon 포함) | "원클릭 자동 동기화" UX 유지. 재배포 라이선스 리스크는 인지하고 감수 |
| 모드팩 잠금 | 완전 잠금 (mods/ 서버와 100% 일치) | 일관성 최우선. 플레이어 개인 클라 모드는 실행 시 제거됨(의도된 동작) |
| 코드 서명 | v1은 미서명 (마찰 감수) | 비용 0. 설계에 서명 단계 자리만 마련 |

### 인지된 리스크
- **Pixelmon 재배포:** Pixelmon ToS는 공식 페이지 외 배포(직링크 포함)를 금지. 자체 호스팅은 ToS 위반 소지가 있으며 법적 리스크를 감수한다. 노출을 줄이려면 큰/제한 jar는 공개 GitHub Releases 대신 별도 호스트로 옮길 수 있도록 manifest를 파일별 `url`로 설계한다.
- **CurseForge 제한 모드:** 일부 모드(예: Macaw's 시리즈)는 제작자가 3rd party 배포를 막아 안정적 핫링크가 없음 → 해당 파일은 자체 호스팅으로 처리.
- **Azure 앱 승인:** 신규 등록 앱은 Minecraft API 사용 승인 전 403이 날 수 있음. 승인 절차/지연을 일정에 반영하고 raw OAuth 폴백을 둔다.
- **미서명 배포:** macOS Gatekeeper("손상됨")·Windows SmartScreen 경고 발생 → 설치 안내(우클릭→열기 / 추가 정보→실행) 제공.

## 3. 아키텍처

### 프로세스 구조 (Electron 표준 분리)
- **Main 프로세스 (Node):** 인증, 다운로드/해시검증, 설치, 게임 실행, Java 관리 등 무거운/민감한 작업.
- **Renderer 프로세스 (웹 UI):** Arknights 쿨톤 디자인 화면.
- **IPC:** preload에서 `contextIsolation: true`, `sandbox: true` 하에 최소·타입드 API만 노출. `nodeIntegration` 비활성. OAuth는 별도 BrowserWindow/웹 플로우로 처리하고 `will-navigate`/`setWindowOpenHandler` 잠금.

### 모듈

| 모듈 | 역할 | 의존 |
|---|---|---|
| `auth` | MS OAuth(msmc) → 마인크래프트 토큰, raw OAuth 폴백, safeStorage 토큰 저장, 자동 갱신/실패 시 재로그인 | Azure Client ID |
| `manifest` | 원격 manifest fetch(ETag 캐시) + 로컬 상태 비교 | GitHub URL |
| `install` | vanilla 클라+라이브러리+에셋 다운로드 + NeoForge 인스톨러 실행 | `@xmcl/installer`, java |
| `sync` | 모드/config diff, temp→해시검증→원자적 교체, 관리경로 화이트리스트 삭제, 검증/복구 | manifest |
| `java` | Java 21 자동 설치/관리 (Adoptium Temurin, win-x64 / mac-aarch64) | - |
| `launch` | NeoForge 1.21.1 실행(모듈러 JVM 인자, mac `-XstartOnFirstThread`/arm64 natives), `--quickPlayMultiplayer` 직접접속 | `@xmcl/core`, auth, java |
| `settings` | RAM 슬라이더, 경로, 직접접속 토글, 로그아웃 | - |
| `diagnostics` | 크래시/로그 표시 및 폴더 열기 | - |

각 모듈은 독립적으로 이해·테스트 가능하도록 명확한 인터페이스로 분리한다.

### 인스턴스 위치
런처 전용 폴더를 별도 관리(Modrinth App 불필요).
- Windows: `%APPDATA%/PokeHavenLauncher/instance`
- macOS: `~/Library/Application Support/PokeHavenLauncher/instance`

현재 Modrinth `pokemon` 프로필은 **최초 manifest 제작용 원본 재료**로만 사용한다.

## 4. 업데이트 메커니즘 (핵심)

### manifest 스키마
```jsonc
{
  "packVersion": "2026.06.16",
  "minecraft": "1.21.1",
  "neoforge": "21.1.233",        // install 모듈이 이 버전으로 vanilla/라이브러리/NeoForge 설치
  "files": [
    { "path": "mods/Pixelmon-1.21.1-9.3.16-universal.jar", "sha1": "...", "size": 413000000, "url": "...", "force": true },
    { "path": "config/pixelmon/...yml", "sha1": "...", "size": ..., "url": "...", "force": true },
    { "path": "config/sodium-options.json", "sha1": "...", "size": ..., "url": "...", "force": false }
  ]
}
```
- vanilla 클라 jar / 라이브러리 / 에셋 인덱스 / NeoForge 버전 프로필은 `files[]`에 넣지 않고 `minecraft`·`neoforge` 버전으로 `install` 모듈이 처리한다.
- 각 파일은 `force` 플래그를 가진다: `true`=업데이트마다 서버 기준으로 덮어씀, `false`=최초 설치 시에만 깔고 이후 보존.

### config 처리 정책 (파일별 force)
- **force: true (서버 강제):** 게임플레이/밸런스 config (예: `config/pixelmon/*`). 모든 플레이어 동일 보장.
- **force: false (보존):** 개인 클라 설정 (예: `sodium-options.json`, `iris.properties`, xaero HUD/키설정 등). 최초만 시드하고 이후 플레이어 변경 보존.

### PLAY / UPDATE 판정
1. 런처 시작 → 원격 `manifest.json` fetch (ETag 캐시).
2. 로컬 저장 `packVersion`과 비교(빠른 체크). 의심 시 전체 파일 해시 스캔(권위 체크).
3. 일치 → **PLAY**, 불일치 → **UPDATE**.
4. 오프라인 → 마지막 설치본으로 PLAY 가능. 온라인인데 manifest fetch 실패(일시적 5xx 등) → UPDATE로 오판하지 않고 에러 표시.

### 동기화 (UPDATE 클릭 시)
- 변경/신규 파일을 **임시 폴더에 다운로드 → size + SHA1 검증 → 원자적 rename**으로 교체.
- 삭제는 **manifest에서 도출한 관리경로 화이트리스트** 기준으로만, 마지막 단계에서 수행. "manifest에 없는 모든 것 삭제"는 금지(사용자 데이터 보호).
- "update-in-progress" 마커를 기록해 중단 시 다음 실행에서 재개/롤백.
- 큰 파일(예: 394MB Pixelmon)은 **HTTP Range 재개** 지원.

### 동기화 범위
- **항상 서버와 일치(덮어씀):** `mods/` (완전 잠금), `force: true` config.
- **절대 건드리지 않음:** `saves/`, `screenshots/`, `options.txt`, `servers.dat`, `logs/`, `crash-reports/`, `force: false` 파일.
- GitHub raw/Release는 단일 장애점이자 rate-limit 대상 → ETag/304 처리, 일시 실패 graceful 처리.

## 5. 로그인 & 실행 흐름

1. 최초 실행 → "MICROSOFT 로그인" → 별도 창에서 OAuth → 토큰 획득 → safeStorage(OS 키체인/DPAPI) 저장, 자동 갱신.
2. 로그인 상태에서 PLAY/UPDATE 표시.
3. PLAY → Java 21 확인(없으면 자동 설치) → `install`로 NeoForge 설치 보장 → `@xmcl/core`로 클라이언트 조립·실행 → 런처 최소화.
4. "서버 바로 접속" 켜짐 → 실행 인자에 `--quickPlayMultiplayer <PokeHaven 서버 주소>`를 넣어 바로 입장.
5. 토큰 갱신 실패(폐기/만료/MS 변경) → 조용히 재로그인 유도. raw OAuth 폴백.

## 6. 에러 처리 & 검증/복구

- **다운로드 실패:** 지수 백오프 재시도 → 실패 시 안내. 중단된 업데이트는 다음 실행 시 마커 감지 후 자동 복구.
- **검증/복구 버튼:** 전체 파일 size+해시 스캔 → 깨지거나 누락된 파일만 재다운로드.
- **실행 크래시:** `diagnostics`가 최신 로그/크래시 리포트 경로 표시 + "폴더 열기".
- **인증 실패:** 토큰 갱신 실패 시 재로그인 유도.

## 7. UI (Arknights / Endfield 쿨톤)

- **톤:** 근블랙/차콜 베이스, 얇은 기하학적 프레임 라인, 시안·청록 액센트, 각진(컷코너) 패널, 모노스페이스/콘덴스드 라벨(영문 대문자 + 한글), HUD풍 상태 표시, 미세 그리드/스캔라인 텍스처.
- **화면:**
  1. **로그인** — 풀스크린 배경 + "PokeHaven Frontier" 로고 + 각진 `MICROSOFT 로그인` 버튼.
  2. **메인** — 상단 프로필(스킨 머리/닉네임), 중앙·하단 대형 PLAY/UPDATE 버튼(상태별 색/글로우), 진행 시 파일명+%+속도 바, 하단 상태줄(packVersion, MC/NeoForge 버전, 온/오프라인), 설정 기어.
  3. **설정** — RAM 슬라이더, 인스턴스 폴더, 검증/복구, 직접접속 토글, 로그아웃.

## 8. 테스트 전략 (TDD 기조)

- **단위 테스트(먼저 작성):** manifest diff, 삭제 플래너(화이트리스트), 해시 검증, config force 정책 해석 — 채워진 인스턴스 픽스처 기반.
- **통합 테스트:** 소형 테스트 팩으로 install → sync → launch 파이프라인(인증은 목).
- **크로스플랫폼:** CI에서 Windows/macOS 빌드, Apple Silicon 실기 스모크 테스트(유닛 불가 영역).

## 9. 외부 의존성 / 셋업 작업

- Azure 애플리케이션 등록(공개/네이티브 클라이언트, 시크릿 미포함, 스코프 `XboxLive.signin offline_access`) → Client ID. Minecraft API 사용 승인 신청.
- GitHub repo(manifest) + Releases(파일) 준비.
- 최초 manifest 생성: 현재 `pokemon` 프로필에서 mods/config의 경로·size·SHA1·force 산정 후 파일 업로드.
- Adoptium Temurin 21 빌드 핀(win-x64, mac-aarch64).

## 10. 미해결/추후 결정

- 큰/제한 jar의 최종 호스트 위치(공개 GitHub vs 별도 호스트) — manifest `url`로 교체 가능하므로 배포 직전 결정.
- 코드 서명 도입 시점(배포 직전 재검토).
- 런처 자체 업데이트(electron-updater) — 서명과 함께 추후.
