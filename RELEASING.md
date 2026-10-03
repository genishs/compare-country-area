# 릴리스 절차

이 레포에서 스토어(Google Play)에 빌드를 올릴 때 따르는 규칙과 체크리스트입니다.

## 1. 브랜치 역할

| 역할 | 브랜치 | 설명 |
|---|---|---|
| 통합 라인 | `main` | 기능·수정이 모이는 곳. 직접 커밋하지 않고 PR로 합칩니다. |
| 출시 라인 | `release/<major>.<minor>` | 스토어에 있거나 심사 중인 버전. 제출하는 순간 만듭니다. |
| 출시 기록 | 태그 `v<versionName>+<versionCode>` | 올린 빌드를 만든 정확한 커밋. 바꾸지 않습니다. |

작업 브랜치 접두사는 다섯 가지만 씁니다: `feature/` `fix/` `doc/` `migration/` `release/`

## 2. 버전 번호

- 정의 위치: `android/app/build.gradle.kts`의 `defaultConfig` (`versionCode`, `versionName`) (여기 한 곳에서만 바꿉니다)
- versionName은 `major.minor.patch`, 빌드 번호(versionCode)는 항상 이전보다 커야 합니다.
- `web/package.json`의 `version`은 빌드 입력이 아니며 앱 버전과 연동되지 않습니다(`private` 패키지). 앱 버전은 위 한 곳에서만 올립니다.
- 버전마다 GitHub 마일스톤(예: "1.0.1 (vc2)")을 만들고 그 버전에 넣을 이슈를 담습니다. 마일스톤을 닫는 것이 곧 출시입니다.

## 3. 태그

- 형식: `v<versionName>+<versionCode>` (예: `v1.0.1+2`). 첫 출시 태그는 `v1.0.0+1`입니다.
- annotated 태그로 만들고 메시지에 다음을 적습니다: 트랙(내부 테스트/프로덕션), 제출일, 산출물(AAB) SHA-256.
- 키스토어 경로·비밀번호 같은 값은 태그·노트·커밋 어디에도 적지 않습니다.
- 태그마다 GitHub Release를 만들고 스토어 출시 노트를 그대로 옮깁니다.

## 4. 제출 체크리스트

- [ ] 마일스톤의 이슈가 모두 닫혔거나 다음 버전으로 옮겨졌다
- [ ] 버전 올림 커밋 (`android/app/build.gradle.kts`의 `defaultConfig` (`versionCode`, `versionName`))
- [ ] 출시 라인 `release/<major>.<minor>`이 없으면 이 커밋에서 만든다(있으면 이 커밋까지 합친다)
- [ ] **데이터 흐름 대조** — 아래 넷이 서로 맞는지 확인
  - 매니페스트 권한, 사용자 입력란(전화번호·이메일 등), 기기 밖으로 나가는 데이터와 받는 곳, 포함된 SDK
  - Play Console 데이터 보안 선언
  - 개인정보처리방침 문구
  - 스토어 설명
- [ ] 서명 릴리스 빌드: `android/`에서 `./gradlew bundleRelease` (Gradle wrapper 9.3.0 포함). 서명 키는 레포 밖에 보관하고 키 경로·비밀번호는 어디에도 적지 않습니다. 키를 찾는 방법은 `android/app/build.gradle.kts` 위쪽 주석(환경변수 `SGSHS_KEYSTORE`·`SGSHS_KEYSTORE_PW_FILE`, 없으면 홈 디렉터리의 기본 위치)을 따르며, 키를 못 찾으면 릴리스 빌드는 실패합니다. 키 없이 확인용 무서명 빌드가 필요하면 `-PallowUnsignedRelease=true`
- [ ] 릴리스 빌드로 에뮬레이터에서 주요 화면·기능 회귀 확인 (API 35 이상, 다크 모드 포함). 1.0.1부터 릴리스 빌드는 R8(코드·리소스 축소)이 켜져 있으므로 반드시 릴리스 빌드로 확인합니다
- [ ] 산출물 SHA-256 기록, 태그 생성·push
- [ ] Play Console 업로드 → 출시 노트 → 검토 제출
- [ ] GitHub Release 작성, 마일스톤 닫기
- [ ] 제출 후 15분쯤 뒤 게시 개요에서 사전 검사 통과(「변경사항을 검토 중입니다」) 확인

## 5. 반려됐을 때

- **Console 선언만 고치는 경우**(데이터 보안 등): 새 빌드가 없으니 새 태그도 없습니다. GitHub Release 노트에 반려 사유와 조치를 적습니다.
- **코드를 고쳐야 하는 경우**: 출시 라인에서 `fix/*` 브랜치를 만들어 고치고, 빌드 번호를 올려 새 태그를 답니다.
- 심사 중에는 다른 변경을 함께 제출하지 않습니다(심사 대기가 처음부터 다시 시작됩니다).

## 6. 출시 후 긴급 수정

1. 출시 라인에서 `fix/*` → PR로 출시 라인에 합침
2. 패치 버전·빌드 번호 올림 → 태그 → 업로드
3. 출시 라인을 통합 라인으로 다시 합치는 PR (덮어쓰지 말고 diff 확인)

이전 출시 라인 브랜치는 다음 버전이 실제로 출시된 뒤 지워도 됩니다. 태그는 남깁니다.

## 7. 이 앱의 데이터 흐름 (제출 전 대조 기준)

- 권한: `INTERNET`, `ACCESS_NETWORK_STATE`. 국가 경계·면적 데이터는 앱에 내장되어 있고, 배경 지도는 OpenStreetMap 공식 타일 서버에서 받아옵니다(요청에 기기의 IP가 전달됨).
- 이 타일 요청은 표준 통신으로 보고 데이터 보안은 **수집 없음**으로 선언합니다. 개인정보처리방침에는 IP 전달 사실을 고지합니다. 처음에 IP를 「대략적인 위치」 수집으로 신고했더니 앱이 17세 이상으로 제한된 적이 있습니다(2026-09-13).
- `web/`을 고쳤다면 `npm run build:android`(`web/`에서 실행, Node만 있으면 OS 무관)로 `android/app/src/main/assets/www/`를 갱신하고, 그 결과를 함께 커밋한 뒤 빌드합니다. 앱에 들어가는 웹 자산은 이 폴더의 커밋된 파일입니다. `npm run check:android`는 둘이 같은지 검사하며, PR에서는 GitHub Actions(`web-assets`)가 같은 검사를 돌립니다.
- 타일 요청의 User-Agent(`DaehanmingukBaroalgi/<versionName>`)는 `MainActivity.kt`가 `BuildConfig.VERSION_NAME`으로 만듭니다. 버전을 올리면 따라 바뀌므로 따로 고칠 곳은 없습니다.
- 개인정보처리방침은 별도 공개 레포(`adrddday-privacy`)의 GitHub Pages(`comparecountry-privacy.html`)에서 호스팅합니다.
