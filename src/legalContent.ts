export type PolicyLocale = 'ko' | 'en'
export type PolicyView = 'terms' | 'refunds' | 'privacy'

type PolicySection = {
  heading: string
  paragraphs: string[]
  bullets?: string[]
}

export type PolicyDocument = {
  title: string
  subtitle: string
  lastUpdated: string
  sections: PolicySection[]
}

export const policyDocuments: Record<
  PolicyLocale,
  Record<PolicyView, PolicyDocument>
> = {
  ko: {
    terms: {
      title: '서비스 약관',
      subtitle:
        '이 약관은 Personal AI Stylist의 디지털 전용 AI 스타일링 소프트웨어와 Polar 결제 흐름 사용에 적용됩니다.',
      lastUpdated: '최종 업데이트: 2026년 3월 9일',
      sections: [
        {
          heading: '1. 서비스 개요',
          paragraphs: [
            'Personal AI Stylist는 사진과 신체 정보를 바탕으로 체형 스타일 보고서, 헤어스타일 추천 이미지, 그리고 외부 생성형 AI에서 사용할 수 있는 프롬프트를 자동 생성하는 디지털 전용 소프트웨어입니다.',
            '이 서비스는 사람의 1:1 상담, 오프라인 시술이나 컨설팅, 실물 상품 배송을 제공하지 않습니다.',
          ],
        },
        {
          heading: '2. 이용 자격 및 업로드 권한',
          paragraphs: [
            '서비스는 성인 사용자 또는 해당 지역 법률상 유효하게 동의할 수 있는 사용자만 이용해야 합니다.',
          ],
          bullets: [
            '본인 사진이거나 적법한 권한을 가진 사진만 업로드해야 합니다.',
            '미성년자 사진, 제3자 사진, 민감하거나 침해 위험이 있는 사진은 권한 없이 업로드하면 안 됩니다.',
            '불법, 유해, 기만적, 괴롭힘성, 침해성 또는 부적절한 방식으로 서비스를 사용하면 안 됩니다.',
          ],
        },
        {
          heading: '3. AI 결과물에 대한 안내',
          paragraphs: [
            '결과물은 AI가 자동 생성하며, 사실관계나 취향 적합성이 항상 완벽하다고 보장되지 않습니다.',
          ],
          bullets: [
            '결과물은 스타일 참고 정보이며, 의료, 법률, 재무, 심리, 취업 또는 기타 전문 자문이 아닙니다.',
            '실제 구매, 시술, 염색, 커트 또는 공개 사용 전에 사용자가 직접 검토하고 판단해야 합니다.',
            '입력 사진의 품질이나 각도, 조명에 따라 결과 품질이 달라질 수 있습니다.',
          ],
        },
        {
          heading: '4. 결제 및 Polar',
          paragraphs: [
            '서비스 내 결제는 Polar를 통해 처리되며, Polar는 해당 디지털 상품의 Merchant of Record 및 재판매자 역할을 수행할 수 있습니다.',
            '결제, 세금, 영수증, 결제 수단 처리, 일부 컴플라이언스 처리는 Polar를 통해 이뤄질 수 있으며, 주문은 사기 방지 또는 규정 준수 사유로 거절되거나 보류될 수 있습니다.',
          ],
        },
        {
          heading: '5. 입력 데이터와 결과물 사용',
          paragraphs: [
            '사용자는 자신이 보유하거나 적법하게 이용할 수 있는 입력 데이터에 대한 권리를 유지합니다.',
          ],
          bullets: [
            '사용자는 서비스 운영과 결과 생성에 필요한 범위에서 입력 데이터를 처리할 수 있는 제한적 권한을 서비스에 부여합니다.',
            '생성된 결과물은 개인적 또는 내부 참고용으로 사용할 수 있습니다.',
            '서비스 결과물을 재판매하거나, 이를 기반으로 사람 상담 서비스인 것처럼 판매하거나, 무단으로 라이선스를 재배포해서는 안 됩니다.',
          ],
        },
        {
          heading: '6. 제한, 중단 및 책임',
          paragraphs: [
            '서비스는 남용, 침해 위험, 보안 문제, 결제 분쟁 또는 법적 요구가 있을 경우 접근을 제한하거나 중단할 수 있습니다.',
            '법이 허용하는 범위에서 서비스는 현 상태 그대로 제공되며, 특정 결과나 무중단 운영을 보장하지 않습니다. 법이 허용하는 범위에서 서비스 관련 책임은 해당 문제와 직접 관련된 결제 금액을 초과하지 않습니다.',
          ],
        },
      ],
    },
    refunds: {
      title: '환불 규정',
      subtitle:
        '이 규정은 Personal AI Stylist의 디지털 전용 결제와 Polar를 통한 주문 처리 기준을 설명합니다.',
      lastUpdated: '최종 업데이트: 2026년 3월 9일',
      sections: [
        {
          heading: '1. 디지털 상품의 특성',
          paragraphs: [
            '이 서비스는 디지털 전용 AI 소프트웨어이며, 결제 후 스타일 보고서, 이미지, 프롬프트 같은 디지털 결과가 제공됩니다.',
            '디지털 액세스가 정상적으로 제공되고 요청한 결과 생성이 이뤄진 경우, 단순 변심만으로는 환불이 어려울 수 있습니다.',
          ],
        },
        {
          heading: '2. 환불이 가능한 경우',
          paragraphs: [
            '다음과 같은 경우에는 관련 법률과 결제 규정에 따라 환불을 검토할 수 있습니다.',
          ],
          bullets: [
            '중복 결제가 발생한 경우',
            '합리적인 재시도 후에도 기술적 문제로 인해 약속된 디지털 결과를 제공하지 못한 경우',
            '무단 결제 또는 사기 결제가 확인된 경우',
            '관련 법률상 환불이 요구되는 경우',
          ],
        },
        {
          heading: '3. 환불이 어려운 경우',
          paragraphs: [
            '아래 사유만으로는 환불이 제한될 수 있습니다.',
          ],
          bullets: [
            '디지털 액세스와 결과 제공이 완료된 뒤의 단순 변심',
            '스타일 취향이나 미적 선호에 대한 주관적 불만만 있는 경우',
            '사용자 입력 사진이 부적절하거나 권한 없는 사진이라 결과가 제한된 경우',
            '서비스 약관 위반, 악용, 결제 정책 위반이 확인된 경우',
          ],
        },
        {
          heading: '4. 환불 요청 방법',
          paragraphs: [
            '환불이 필요하면 결제 후 7일 이내에 Polar 영수증 또는 이 웹사이트에 안내된 지원 경로를 통해 문의하는 것이 가장 좋습니다.',
            '주문 번호, 결제 이메일, 발생한 문제, 이미 시도한 조치를 함께 제공하면 검토가 빨라집니다.',
          ],
        },
        {
          heading: '5. 환불 처리 방식',
          paragraphs: [
            '승인된 환불은 원래 결제 수단으로 반환되며, 실제 반영 시점은 Polar 및 카드사나 은행 처리 일정에 따라 달라질 수 있습니다.',
            '서비스 내부 제공 실패가 확인되면, 일부 경우에는 시스템이 자동으로 환불을 요청할 수 있습니다.',
          ],
        },
      ],
    },
    privacy: {
      title: '개인정보 처리방침',
      subtitle:
        '이 방침은 Personal AI Stylist가 사진, 신체 정보, 결제 정보를 어떻게 처리하는지 설명합니다.',
      lastUpdated: '최종 업데이트: 2026년 3월 9일',
      sections: [
        {
          heading: '1. 수집하는 정보',
          paragraphs: [
            '서비스는 사용자가 직접 제공하거나 결제 과정에서 생성되는 일부 정보를 처리할 수 있습니다.',
          ],
          bullets: [
            '업로드한 사진, 키, 몸무게, 언어 선택값',
            '생성된 스타일 보고서, 헤어스타일 결과, 복사용 프롬프트',
            '주문 번호, 결제 상태, 결제 이메일 같은 결제 메타데이터',
            '기기와 브라우저에서 생성되는 기본 기술 정보와 오류 로그',
          ],
        },
        {
          heading: '2. 정보를 사용하는 목적',
          bullets: [
            '스타일 보고서와 헤어스타일 결과를 생성하고 전달하기 위해',
            '결제 확인, 주문 처리, 환불 검토, 사기 방지 및 보안 운영을 위해',
            '서비스 품질 개선, 오류 진단, 법적 의무 이행을 위해',
          ],
          paragraphs: [],
        },
        {
          heading: '3. 외부 처리자 및 공유',
          paragraphs: [
            '서비스 운영을 위해 일부 데이터는 외부 처리자와 공유될 수 있습니다.',
          ],
          bullets: [
            'Google Gemini: AI 결과 생성',
            'Cloudflare Pages/Workers: 호스팅 및 서버 실행',
            'Polar: 결제, 영수증, 세금 및 관련 주문 처리',
          ],
        },
        {
          heading: '4. 보관 및 삭제',
          paragraphs: [
            '현재 앱 흐름에서는 업로드 사진을 자체 영구 데이터베이스에 장기 저장하지 않도록 설계되어 있습니다. 다만 전송 과정의 로그, 캐시, 보안 기록, 외부 처리자 시스템에는 제한적으로 일시 보관될 수 있습니다.',
            '주문 및 결제 관련 정보는 회계, 분쟁 대응, 법적 의무 이행을 위해 필요한 기간 동안 보관될 수 있습니다.',
          ],
        },
        {
          heading: '5. 이용자 권리',
          paragraphs: [
            '적용 법률에 따라 사용자는 자신의 개인정보에 대한 접근, 수정, 삭제 또는 처리 제한을 요청할 수 있습니다.',
            '개인정보 또는 환불 관련 문의는 Polar 영수증 또는 이 사이트에 표시된 지원 경로를 통해 접수할 수 있습니다.',
          ],
        },
        {
          heading: '6. 아동 및 민감 정보',
          paragraphs: [
            '이 서비스는 미성년자를 대상으로 하지 않으며, 미성년자 사진을 업로드하지 않아야 합니다.',
            '주민등록번호, 여권번호, 건강정보 같은 민감하거나 불필요한 개인정보는 업로드하지 마세요.',
          ],
        },
      ],
    },
  },
  en: {
    terms: {
      title: 'Terms of Service',
      subtitle:
        'These terms govern the use of Personal AI Stylist and the Polar checkout flow for this digital-only AI styling product.',
      lastUpdated: 'Last updated: March 9, 2026',
      sections: [
        {
          heading: '1. Service overview',
          paragraphs: [
            'Personal AI Stylist is a digital-only software product that automatically generates body style reports, hairstyle recommendation images, and reusable prompts from uploaded photos and body details.',
            'The service does not provide human consultation, offline appointments, physical goods, or in-person styling services.',
          ],
        },
        {
          heading: '2. Eligibility and upload rights',
          paragraphs: [
            'The service is intended for adults or other users who can legally consent under the laws that apply to them.',
          ],
          bullets: [
            'You may upload only photos you own or are authorized to use.',
            'Do not upload photos of minors, third parties, or sensitive subjects without valid permission.',
            'You may not use the service for illegal, harmful, deceptive, abusive, infringing, or otherwise improper purposes.',
          ],
        },
        {
          heading: '3. AI output notice',
          paragraphs: [
            'All outputs are generated automatically by AI and may be incomplete, imperfect, or subjective.',
          ],
          bullets: [
            'Outputs are for styling inspiration and informational use only.',
            'They are not medical, legal, financial, employment, or other professional advice.',
            'You remain responsible for reviewing any recommendation before purchasing products, changing your appearance, or publishing results.',
          ],
        },
        {
          heading: '4. Payments and Polar',
          paragraphs: [
            'Payments are processed through Polar. For purchases made through Polar checkout, Polar may act as the Merchant of Record and reseller for the digital product.',
            'Payment processing, taxes, receipts, and certain compliance functions may therefore be handled through Polar, and orders may be delayed, limited, declined, or refunded for fraud, abuse, or compliance reasons.',
          ],
        },
        {
          heading: '5. Inputs, outputs, and license',
          paragraphs: [
            'You keep your rights in lawful content that you upload, to the extent those rights exist.',
          ],
          bullets: [
            'You grant the service a limited license to process your inputs as needed to operate the product and generate outputs.',
            'Generated outputs are licensed to you on a limited, non-exclusive basis for your personal or internal reference use.',
            'You may not resell the service, redistribute raw access, or market the product as a human stylist or consulting service performed by our team.',
          ],
        },
        {
          heading: '6. Restrictions, suspension, and liability',
          paragraphs: [
            'Access may be limited or suspended for abuse, infringement risk, security issues, payment disputes, or legal compliance needs.',
            'To the maximum extent permitted by law, the service is provided on an as-is basis without guarantees of uninterrupted availability or specific outcomes. To the maximum extent permitted by law, liability is limited to the amount paid for the affected purchase.',
          ],
        },
      ],
    },
    refunds: {
      title: 'Refund Policy',
      subtitle:
        'This policy explains how refunds work for Personal AI Stylist purchases processed as digital-only software orders through Polar.',
      lastUpdated: 'Last updated: March 9, 2026',
      sections: [
        {
          heading: '1. Digital product nature',
          paragraphs: [
            'This product provides digital-only AI access and digital outputs such as reports, images, and reusable prompts.',
            'If digital access works and the requested outputs are successfully delivered, a refund may not be available simply because you changed your mind.',
          ],
        },
        {
          heading: '2. When refunds may be available',
          paragraphs: [
            'Refunds may be considered where required by law or in situations such as the following.',
          ],
          bullets: [
            'A duplicate charge',
            'A technical failure that prevents delivery of the promised digital output after reasonable retry attempts',
            'An unauthorized or fraudulent charge that is verified',
            'Any other circumstance where a refund is legally required',
          ],
        },
        {
          heading: '3. When refunds may be denied',
          paragraphs: [
            'Refund requests may be denied in cases such as the following.',
          ],
          bullets: [
            'A change of mind after digital access and delivery have already succeeded',
            'Purely subjective dissatisfaction with style preferences after outputs were delivered',
            'Problems caused by unsupported, low-quality, or unauthorized source images provided by the user',
            'Misuse of the service or a violation of the Terms of Service',
          ],
        },
        {
          heading: '4. How to request a refund',
          paragraphs: [
            'If you need a refund review, it is best to contact support within 7 days of purchase using the support path shown in your Polar receipt or on this website.',
            'Please include your order ID, purchase email, a short description of the issue, and the steps you already tried.',
          ],
        },
        {
          heading: '5. Refund processing',
          paragraphs: [
            'Approved refunds are returned to the original payment method through Polar. Final posting times depend on your card issuer, bank, or payment provider.',
            'If internal digital fulfillment fails after payment is confirmed, the system may in some cases request a refund automatically.',
          ],
        },
      ],
    },
    privacy: {
      title: 'Privacy Policy',
      subtitle:
        'This policy explains how Personal AI Stylist handles uploaded photos, body details, generated outputs, and payment-related information.',
      lastUpdated: 'Last updated: March 9, 2026',
      sections: [
        {
          heading: '1. Information we process',
          paragraphs: [
            'We may process information you provide directly and certain information created during checkout or service operation.',
          ],
          bullets: [
            'Uploaded photos, height, weight, and language preference',
            'Generated style reports, hairstyle outputs, and copy-ready prompts',
            'Payment metadata such as order ID, payment status, and purchase email',
            'Basic technical information and error logs generated by your device or browser',
          ],
        },
        {
          heading: '2. How we use information',
          paragraphs: [],
          bullets: [
            'To generate and deliver style reports, hairstyle recommendations, and related prompts',
            'To verify payment, process orders, review refunds, prevent fraud, and secure the service',
            'To diagnose errors, improve service quality, and comply with legal obligations',
          ],
        },
        {
          heading: '3. Service providers and sharing',
          paragraphs: [
            'We use third-party processors to operate the product.',
          ],
          bullets: [
            'Google Gemini for AI generation',
            'Cloudflare Pages/Workers for hosting and server execution',
            'Polar for checkout, receipts, taxes, and payment-related order handling',
          ],
        },
        {
          heading: '4. Retention and deletion',
          paragraphs: [
            'In the current app flow, we do not intentionally keep uploaded photos in our own long-term database beyond what is needed to process the request. However, temporary retention may still occur in logs, caches, security records, or third-party processor systems.',
            'Order and payment-related records may be retained as needed for accounting, dispute handling, security, fraud prevention, and legal compliance.',
          ],
        },
        {
          heading: '5. Your choices and rights',
          paragraphs: [
            'Depending on applicable law, you may have rights to request access, correction, deletion, or restriction of personal information that we control.',
            'Privacy or refund-related requests can be submitted through the support path shown in your Polar receipt or on this website.',
          ],
        },
        {
          heading: '6. Minors and sensitive data',
          paragraphs: [
            'The service is not intended for minors, and you should not upload photos of minors.',
            'Please do not upload unnecessary sensitive information such as government identification numbers, passport details, or detailed health information.',
          ],
        },
      ],
    },
  },
}
