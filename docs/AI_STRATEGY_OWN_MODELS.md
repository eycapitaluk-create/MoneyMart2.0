# 머니마트 자체 AI 전략 (비용 절감 + 기능 확대)

## 0. 지금 바로 할 수 있는 첫 단계: Ollama 챗봇

**이미 적용됨.** 챗봇 API(`/api/chat`)는 **Ollama를 1순위**로 호출하고, 실패하거나 설정이 없으면 Gemini로 넘어갑니다.

### 로컬에서 쓰는 방법

1. **Ollama 설치**  
   - [ollama.com](https://ollama.com) 에서 설치 후 터미널에서:
   ```bash
   ollama pull qwen2.5:7b-instruct
   ```
   (일본어에 적합한 모델. `llama3.2`, `mistral` 등도 가능)

2. **환경 변수 설정**  
   프로젝트 루트 `.env` 또는 `.env.local`에 추가:
   ```bash
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=qwen2.5:7b-instruct
   ```

3. **개발 서버 실행**  
   `npm run dev` 후 PRIME 로그인 → 챗봇에서 메시지 보내기.  
   Ollama가 떠 있으면 **Gemini 비용 없이** 로컬 모델로 응답합니다.

4. **나중에 서버 배포 시**  
   vLLM 등으로 띄운 엔드포인트를 `OLLAMA_BASE_URL`에 넣으면 됩니다 (OpenAI 호환 API면 동일하게 동작).

---

## 1. 현재 외부 의존도와 비용 구조

| 기능 | 현재 사용 | 비용 특성 |
|------|-----------|-----------|
| **챗봇** | Gemini API (`/api/chat`) | 호출당 토큰 과금, 유저↑ → 비용↑ |
| **리포트/디제스트** | 룰 기반 (DB + 정규식, `lounge-digest`) | **LLM 미사용** → 비용 없음 |
| **레시트 OCR** | GCP Document AI + AWS Textract (`/api/ocr/receipt`) | 문서/이미지당 과금, 유저↑ → 비용↑ |
| **클라이언트 OCR** | 로컬 OCR (Tesseract.js 등) 폴백 | 무료, 품질은 상대적으로 낮음 |

→ **유저가 늘수록 비용이 크게 늘나는 구간: 챗봇(Gemini), 레시트 OCR(Document AI / Textract)**

---

## 2. “머니마트만의 AI”로 갈 수 있는 방향

### 2-1. 챗봇 + 리포트 생성: **자체 호스팅 오픈 LLM**

- **아이디어**: Google/OpenAI 대신 **오픈 소스 LLM**을 우리 서버(또는 전용 GPU 서버)에서 돌리고, 같은 `/api/chat` 또는 새 `/api/ai/chat` 형태로 제공.
- **장점**
  - 서버/GPU 고정비만 들면 되고, **호출 수가 늘어나도 토큰당 추가 과금 없음**.
  - 금융/가계 도메인에 맞게 **프롬프트·시스템 메시지**만 잘 잡으면 “머니마트만의 톤” 구현 가능.
  - 나중에 **파인튜닝**까지 하면 더 우리 서비스에 특화된 답변 가능.
- **구체적 선택지**
  - **로컬/소규모**: [Ollama](https://ollama.com) (개발·테스트용)
  - **프로덕션 API 서버**: [vLLM](https://github.com/vllm-project/vllm), [Text Generation Inference (TGI)](https://github.com/huggingface/text-generation-inference)
  - **모델 예시**: Llama 3.2, Mistral 7B, Qwen2 7B/14B, Phi-3 등 (일본어 지원 괜찮은 것 위주)
- **인프라**
  - GPU 서버 1대 (예: A10 24GB, L4 등) 또는 [RunPod](https://runpod.io), [Lambda Labs](https://lambdalabs.com), [Vast.ai](https://vast.ai) 등에서 GPU 인스턴스 월 고정비.
  - 비용: 월 수십만 원~수백만 원 수준으로 고정, **유저 수와 무관**.

이렇게 하면 **챗봇**은 완전히 우리 인프라로 돌리고, **리포트 문장 생성**도 같은 LLM으로 “한 줄 요약”, “오늘의 팁” 같은 걸 붙일 수 있습니다.

### 2-2. OCR: **무료/오픈 OCR로 전환 또는 혼합**

- **현재**: GCP Document AI + AWS Textract (이미지/문서당 과금).
- **전환 옵션**
  1. **서버 OCR을 오픈 소스로**
     - **Tesseract** (C++/Python): 서버에 설치해 API로 감싸기. 무료, 레시트 품질은 보통.
     - **PaddleOCR**, **EasyOCR**: 딥러닝 기반, 일본어 지원 가능, 우리가 서버에 직접 설치해 실행 가능.
     - **DocTR**, **Donut** 등: 문서 이해 특화 모델, 필요하면 레시트 레이아웃까지 활용 가능.
  2. **하이브리드**
     - 기본: **Tesseract 또는 PaddleOCR** (무료, 자체 서버)로 처리.
     - “신뢰도 낮음” 또는 “파싱 실패”일 때만 Document AI / Textract 호출 (호출 수를 크게 줄임).
- **클라이언트**
   - 이미 **로컬 OCR 폴백**이 있으므로, 서버를 무료 OCR로 바꿔도 “서버 실패 시 브라우저에서 한 번 더 시도” 구조는 유지 가능.

→ **OCR 비용을 거의 제로에 가깝게 줄이거나, 어려운 케이스만 유료 API**로 보내는 구조가 가능합니다.

### 2-3. 리포트 자동 생성 (지금은 룰 기반)

- **현재**: `lounge-digest`는 뉴스 제목·DB 통계 기반 **룰/템플릿**만 사용, LLM 없음.
- **확장**
  - “오늘의 한 줄 코멘트”, “이번 주 추천 액션” 같은 문장은 **자체 호스팅 LLM**에 짧은 프롬프트로 생성하게 하면 “머니마트만의 리포트” 느낌을 낼 수 있음.
  - 입력은 기존처럼 DB 집계 결과 + 뉴스 헤드라인만 넘겨도 됨 (토큰 사용량 작게 유지).

---

## 3. 단계별 로드맵 제안

| 단계 | 내용 | 효과 |
|------|------|------|
| **1** | 챗봇: Gemini 대신 **자체 호스팅 LLM** (vLLM 등)으로 `/api/chat` 교체. 시스템 프롬프트로 “머니마트 금융/가계 어드바이저” 톤 고정. | 챗봇 호출 비용 고정화 |
| **2** | 레시트 OCR: 서버에 **Tesseract 또는 PaddleOCR** 도입, 1차로 사용. 실패/저신뢰도만 Document AI·Textract 호출. | OCR 비용 대폭 감소 |
| **3** | 리포트: 디제스트에 **한두 문장**만 자체 LLM으로 생성해 넣기. | “우리만의 리포트” 강화, 비용은 토큰 소량 |
| **4** | (선택) 일본어·금융 데이터로 **파인튜닝** 또는 소규모 모델 학습. | 답변 품질·일관성 추가 향상 |

---

## 4. 기술 스택 예시 (자체 LLM 서버)

- **추론 서버**: vLLM 또는 TGI
- **모델**: Qwen2-7B-Instruct (일본어 우수), 또는 Llama 3.2 8B
- **API**: OpenAI 호환 엔드포인트로 띄우면 기존 `fetch('/api/chat')`를 새 베이스 URL로만 바꿔도 연동 가능
- **OCR**: Python + Tesseract 또는 PaddleOCR → Node에서 `child_process` 또는 별도 OCR API 서비스로 호출

---

## 5. 정리

- **가능합니다.**  
  챗봇·리포트는 **자체 호스팅 오픈 LLM**, OCR은 **무료/오픈 OCR + 필요 시에만 유료 API**로 가면, “머니마트만의 AI”를 유지하면서 **유저가 많아져도 비용이 선형으로 치솟는 구조를 피할 수 있습니다.**
- **우선 적용하기 좋은 것**
  1. 챗봇을 **자체 LLM (vLLM + Qwen2 등)** 으로 전환.
  2. 레시트 OCR을 **Tesseract/PaddleOCR 1차 + Document AI/Textract는 예외만** 사용하도록 변경.

이 문서는 `utn` 워크트리 기준 현재 코드 구조를 반영했습니다.  
구체적인 API 스펙·env 변수·배포 방식이 필요하면 그 다음 단계에서 설계하면 됩니다.
