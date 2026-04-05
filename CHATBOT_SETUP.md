# MoneyMart 고객 상담 AI 챗봇 설치 가이드

## 개요

Claude Haiku 3.5 모델을 기반으로 한 고객 상담 AI 챗봇입니다. 실시간으로 고객 질문에 응답하고, 투자 및 금융 관련 정보를 제공합니다.

## 설치 단계

### 1. 의존성 설치

```bash
npm install
```

`@anthropic-ai/sdk`가 자동으로 설치됩니다.

### 2. 환경 변수 설정

`.env.local` 파일에 다음을 추가하세요:

```
ANTHROPIC_API_KEY=your_anthropic_api_key
```

[Anthropic API 키](https://console.anthropic.com/account/keys)에서 API 키를 받을 수 있습니다.

### 3. 앱에 컴포넌트 통합

메인 앱 컴포넌트(예: `App.jsx` 또는 `Layout.jsx`)에 다음과 같이 추가하세요:

```jsx
import CustomerChatbot from './components/CustomerChatbot'

export default function App() {
  return (
    <div>
      {/* 기존 콘텐츠 */}
      <CustomerChatbot />
    </div>
  )
}
```

### 4. 빌드 및 배포

```bash
npm run build
npm run preview
```

Vercel에 배포하면 API 엔드포인트도 자동으로 배포됩니다.

## 기능

- ✅ 실시간 채팅 인터페이스
- ✅ 한국어/영어 지원
- ✅ 투자 및 금융 상담
- ✅ 자동 스크롤 (새 메시지 표시)
- ✅ 로딩 상태 표시
- ✅ 에러 처리

## API 엔드포인트

**POST** `/api/chatbot`

**요청:**
```json
{
  "messages": [
    { "role": "user", "content": "질문 내용" },
    { "role": "assistant", "content": "이전 응답" }
  ]
}
```

**응답:**
```json
{
  "ok": true,
  "message": "챗봇 응답 메시지",
  "usage": {
    "input_tokens": 100,
    "output_tokens": 50
  }
}
```

## 커스터마이징

### 시스템 프롬프트 수정

`/api/chatbot.js`의 `SYSTEM_PROMPT`를 수정하여 챗봇의 성격과 지식 기반을 변경할 수 있습니다.

### 모델 변경

```javascript
// api/chatbot.js에서
model: 'claude-3-5-sonnet-20241022', // Sonnet으로 변경 가능
```

사용 가능한 모델:
- `claude-3-5-haiku-20241022` (현재, 저비용)
- `claude-3-5-sonnet-20241022` (더 강력함)
- `claude-opus-4-1-20250805` (최고 성능)

### 스타일 커스터마이징

`src/components/CustomerChatbot.jsx`의 Tailwind 클래스를 수정하여 UI를 변경할 수 있습니다.

## 비용 관리

- **Haiku**: $0.80 / M input, $4.00 / M output 토큰
- **Sonnet**: $3 / M input, $15 / M output 토큰

`max_tokens: 1024`로 제한하여 응답 길이를 관리할 수 있습니다.

## 문제 해결

### API 키 오류
- `.env.local`에 `ANTHROPIC_API_KEY`가 설정되어 있는지 확인
- Vercel 배포 시 환경 변수 설정 확인

### 메시지 전송 안 됨
- 네트워크 연결 확인
- 브라우저 콘솔에서 오류 메시지 확인

### 응답이 느림
- Claude 서버 상태 확인
- `max_tokens` 값 확인

## 보안 주의사항

- API 키는 절대 클라이언트 코드에 노출하면 안 됩니다 (서버 사이드 전용)
- 사용자 입력은 검증되지 않은 상태로 Claude에 전송됩니다
- 민감한 정보(계정 번호, 비밀번호 등)는 공유하지 않도록 안내
