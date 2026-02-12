# MoneyMart 2.0 - Vercel + GitHub 배포 가이드

## 1. GitHub에 프로젝트 올리기

### Git 초기화 및 커밋

```bash
cd /Users/justinnam/Desktop/MoneyMart2.0

# Git 초기화
git init

# 모든 파일 스테이징
git add .

# 첫 커밋
git commit -m "Initial commit: MoneyMart 2.0"
```

### GitHub 저장소 생성 및 푸시

1. [GitHub](https://github.com) 접속 → **New repository** 클릭
2. Repository name: `MoneyMart2.0` (또는 원하는 이름)
3. **Private** 또는 **Public** 선택
4. **Create repository** 클릭 (README, .gitignore 추가하지 않기)

```bash
# GitHub 저장소 연결
git remote add origin https://github.com/eycapitaluk-create/MoneyMart2.0.git

# main 브랜치로 푸시
git branch -M main
git push -u origin main
```

---

## 2. Vercel 연동

### 방법 A: Vercel 웹사이트에서 직접

1. [vercel.com](https://vercel.com) 접속 → **Sign Up** (GitHub 계정으로 로그인)
2. **Add New** → **Project** 클릭
3. **Import Git Repository**에서 방금 만든 GitHub 저장소 선택
4. **Configure Project**:
   - **Framework Preset**: Vite (자동 감지됨)
   - **Build Command**: `npm run build` (기본값)
   - **Output Directory**: `dist` (기본값)
   - **Install Command**: `npm install` (기본값)
5. **Environment Variables**:
   - `VITE_SUPABASE_URL` = Supabase 프로젝트 URL
   - `VITE_SUPABASE_ANON_KEY` = Supabase anon key
   - `SUPABASE_URL` = Supabase 프로젝트 URL (server-side)
   - `SUPABASE_SECRET_KEY` = Supabase service role key (server-side)
   - `CRON_SECRET` = cron 보호 토큰 (랜덤 문자열)
   - `MARKETSTACK_ACCESS_KEY` = marketstack API key (server-side)
   - `MARKETSTACK_SYMBOLS` = (선택) 수집 심볼 목록, 예: `AAPL,MSFT,NVDA`
6. **Deploy** 클릭

### 방법 B: Vercel CLI

```bash
# Vercel CLI 설치
npm i -g vercel

# 프로젝트 폴더에서 로그인 및 배포
cd /Users/justinnam/Desktop/MoneyMart2.0
vercel

# 로그인 후 질문에 답변:
# - Set up and deploy? Y
# - Which scope? (본인 계정)
# - Link to existing project? N
# - Project name? moneymart2 (또는 원하는 이름)
# - Directory? ./
```

---

## 3. 배포 후 자동 배포

GitHub와 Vercel을 연결하면:

- **main 브랜치에 push** → 자동으로 새 배포
- **프리뷰 배포**: `main` 브랜치가 아닌 브랜치에 push하면 미리보기 URL 생성

---

## 4. 환경 변수 (중요)

`.env` 파일이 있으면 다음 환경 변수를 Vercel 대시보드에 추가하세요:

- **Settings** → **Environment Variables**
- `VITE_SUPABASE_URL` (Production/Preview/Development)
- `VITE_SUPABASE_ANON_KEY` (Production/Preview/Development)
- `SUPABASE_URL` (Production/Preview)
- `SUPABASE_SECRET_KEY` (Production/Preview)  
  - `SUPABASE_SERVICE_ROLE_KEY`를 쓰는 경우도 있으나, 프로젝트에서는 `SUPABASE_SECRET_KEY`를 우선 사용
- `MARKETSTACK_ACCESS_KEY` (Production/Preview)
- `CRON_SECRET` (Production/Preview)
- `MARKETSTACK_SYMBOLS` (선택)

⚠️ `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `MARKETSTACK_ACCESS_KEY`는 서버 전용 비밀값입니다.  
절대 클라이언트 코드(`VITE_*`)로 노출하지 마세요.

---

## 5. 커스텀 도메인 (선택)

Vercel 대시보드 → **Settings** → **Domains**에서:
- `your-domain.com` 형식의 도메인 추가 가능
- `vercel.app` 서브도메인은 기본 제공
