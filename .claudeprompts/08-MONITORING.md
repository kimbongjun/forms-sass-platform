# 모니터링 — 웹사이트를 모니터링하여 이상 유무를 점검하고 리포트하는 컴포넌트

> 최초 작성: 2026-04-10
> 위치: Aside 사이드바 하단 (WORKSPACE_HUBS 네 번째)

---

## 개요

URL 입력된 사이트들의 "접속 오류, 응답 지연, 특정 국가 접속 불량" 등을 설정해놓은 주기에 맞춰서 체크하고 점검한 결과를 이메일로 발송해주는 기능.

## 필요 기능

1. 가용성 및 신뢰성 지표 (Availability)
가동 시간 (Uptime): 서버가 중단 없이 운영되는 비율
응답 코드 (HTTP Status Codes): 200(성공), 404(페이지 찾지 못함), 500(서버 오류) 등의 발생 빈도 추적

2. 웹 성능 지표 (Performance & Web Vitals)
LCP (Largest Contentful Paint)
INP (Interaction to Next Paint)
CLS (Cumulative Layout Shift)
TTFB (Time to First Byte)

3. 리소스 및 에러 지표 (Technical Health)
에러율 (Error Rate)
자바스크립트 에러
서버 리소스: CPU 사용률, 메모리 점유율, 디스크 I/O 등을 모니터링하여 트래픽 급증 체크