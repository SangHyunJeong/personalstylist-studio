// Before public launch, add your registered entity name, support channel,
// and any legally required business/contact disclosures for your jurisdiction.

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

const koSupportRoute =
  '이 사이트에 표시된 지원 경로 또는 Polar 영수증에 표시된 지원 연락처'

const enSupportRoute =
  'the support route shown on this site or in your Polar receipt'

export const policyDocuments: Record<
  PolicyLocale,
  Record<PolicyView, PolicyDocument>
> = {
  ko: {
    terms: {
      title: '서비스 약관',
      subtitle:
        '이 약관은 Personal AI Stylist의 디지털 전용 AI 스타일링 소프트웨어, 생성형 결과물, 그리고 Polar를 통한 결제 흐름에 적용됩니다.',
      lastUpdated: '최종 업데이트: 2026년 3월 9일',
      sections: [
        {
          heading: '1. 서비스 범위',
          paragraphs: [
            'Personal AI Stylist는 사용자가 업로드한 사진과 신체 정보를 바탕으로 체형 스타일 보고서, 헤어스타일 추천 이미지, 그리고 외부 생성형 AI에서 사용할 수 있는 프롬프트를 자동 생성하는 디지털 전용 소프트웨어입니다.',
            '이 서비스는 사람의 1:1 상담, 오프라인 스타일링, 미용 시술, 실물 상품 배송 또는 인간 전문가가 직접 수행하는 컨설팅을 제공하지 않습니다.',
          ],
        },
        {
          heading: '2. 이용 자격과 미성년자 제한',
          paragraphs: [
            '서비스는 원칙적으로 성인 또는 자신에게 적용되는 법률에 따라 유효하게 동의할 수 있는 사용자만 이용해야 합니다.',
            '서비스는 아동을 대상으로 하지 않으며, 13세 미만 아동의 사진이나 정보를 업로드해서는 안 됩니다. 거주 지역 법률상 더 높은 연령 기준이 적용되면 그 기준이 우선합니다.',
          ],
        },
        {
          heading: '3. 사용자 입력과 업로드 권한',
          paragraphs: [
            '사용자는 자신이 소유하거나 적법한 사용 권한이 있는 사진과 정보만 업로드해야 합니다.',
          ],
          bullets: [
            '본인 사진이 아니거나 제3자의 권리를 침해할 수 있는 자료를 무단 업로드하면 안 됩니다.',
            '민감한 개인정보, 정부 발급 식별번호, 금융정보, 건강정보, 미성년자 사진 등 불필요하거나 고위험 정보는 업로드하지 마세요.',
            '불법, 유해, 차별적, 기만적, 괴롭힘성, 명예훼손성, 침해성 또는 결제망 규정을 위반하는 방식으로 서비스를 사용하면 안 됩니다.',
          ],
        },
        {
          heading: '4. AI 결과물과 책임 제한',
          paragraphs: [
            '서비스의 보고서, 이미지, 프롬프트 및 기타 결과물은 생성형 AI에 의해 자동 생성됩니다. 결과물은 참고용이며 항상 완전, 정확 또는 개별 상황에 최적이라고 보장되지 않습니다.',
          ],
          bullets: [
            '결과물은 스타일 참고 정보일 뿐이며 의료, 법률, 세무, 재무, 고용, 심리 또는 기타 전문 자문이 아닙니다.',
            '실제 구매, 커트, 펌, 염색, 공개 게시 또는 상업적 사용 전에 사용자가 직접 검토하고 판단해야 합니다.',
            '입력 사진의 품질, 각도, 조명, 얼굴 가림 여부, 신체 정보의 정확성에 따라 결과 품질이 달라질 수 있습니다.',
          ],
        },
        {
          heading: '5. 결제, 세금, 디지털 제공',
          paragraphs: [
            '서비스 내 결제는 Polar를 통해 처리되며, Polar는 관련 주문에서 Merchant of Record 또는 재판매자 역할을 수행할 수 있습니다.',
            '가격, 통화, 결제 수단, 세금, 영수증 발행, 결제 검증, 사기 심사, 일부 환불 처리는 Polar 또는 적용 법률과 결제 네트워크 규칙에 따라 처리될 수 있습니다.',
            '결제가 확인되면 디지털 액세스 및 생성 흐름이 시작되거나 재개됩니다. 현지 법률이 강행규정으로 부여하는 소비자 권리는 본 약관보다 우선합니다.',
          ],
        },
        {
          heading: '6. 환불 및 철회권',
          paragraphs: [
            '환불 기준은 별도의 환불 규정에 따르며, 현지 강행법상 인정되는 철회권, 청약철회권 또는 디지털 콘텐츠 관련 소비자 권리는 해당 법률에 따라 별도로 적용될 수 있습니다.',
            '현지 법률이 허용하고 구매 흐름에서 필요한 동의가 적법하게 이루어진 경우, 디지털 서비스가 즉시 제공되면서 일부 철회권이 제한될 수 있습니다.',
          ],
        },
        {
          heading: '7. 허용되지 않는 사용',
          paragraphs: [
            '다음과 같은 사용은 금지됩니다.',
          ],
          bullets: [
            '서비스를 사람 컨설팅, 의료 조언, 미성년자 대상 서비스, 불법 마케팅 또는 타인의 권리 침해에 이용하는 행위',
            '서비스 또는 결과물을 재판매하거나, 라이선스 없이 복제·배포하거나, 대량 자동화 서비스로 재포장하는 행위',
            '보안 우회, 리버스 엔지니어링, 과도한 트래픽, 악성 업로드, 결제 남용, 차지백 악용 등 서비스 안정성을 해치는 행위',
          ],
        },
        {
          heading: '8. 지식재산 및 이용 허락',
          paragraphs: [
            '사용자는 자신이 적법하게 업로드한 입력 데이터에 대한 권리를 유지합니다. 단, 서비스 운영과 결과 생성에 필요한 범위에서 서비스가 이를 처리할 수 있는 제한적 권한을 부여합니다.',
            '서비스 소프트웨어, 인터페이스, 브랜드, 상표, 디자인, 운영 로직에 대한 권리는 서비스 제공자 또는 그 라이선스 제공자에게 있습니다.',
          ],
          bullets: [
            '생성 결과물은 사용자에게 개인적 또는 내부 참고용의 제한적 비독점 사용 권한으로 제공됩니다.',
            '서비스 자체, 원시 액세스 권한, 자동화된 대량 결과 제공 권한을 제3자에게 판매하거나 이전해서는 안 됩니다.',
          ],
        },
        {
          heading: '9. 개인정보 및 국제 처리',
          paragraphs: [
            '서비스 사용에는 개인정보 처리방침이 함께 적용됩니다. 서비스는 Cloudflare, Google Gemini, Polar 같은 외부 처리자를 통해 운영될 수 있으며, 이에 따라 사용자의 데이터가 거주 국가 밖으로 전송될 수 있습니다.',
            '서비스는 사용자의 사진을 얼굴 인식 기반 신원 확인 목적으로 제공하지 않으며, 스타일 결과 생성 목적 범위 내에서만 처리하려고 합니다.',
          ],
        },
        {
          heading: '10. 가용성, 변경, 중단',
          paragraphs: [
            '서비스는 유지보수, 보안, 결제 분쟁, 사기 방지, 법적 요구, 제3자 API 제한 또는 운영상 필요에 따라 일부 또는 전부가 변경, 제한 또는 중단될 수 있습니다.',
            '기능, 모델, 가격, 지원 범위는 향후 변경될 수 있으며, 중요한 조건 변경은 합리적인 방식으로 고지됩니다.',
          ],
        },
        {
          heading: '11. 현지 강행법과 분쟁',
          paragraphs: [
            '거주 국가의 소비자 보호법, 개인정보 보호법, 전자상거래법 등 강행규정이 본 약관과 충돌하는 경우 해당 강행규정이 우선합니다.',
            '법이 허용하는 범위에서 본 서비스는 현 상태 그대로 제공되며 특정 결과나 무중단 운영을 보장하지 않습니다. 법이 허용하는 범위에서 서비스 제공자의 책임은 해당 문제와 직접 관련된 구매 금액을 초과하지 않습니다.',
          ],
        },
        {
          heading: '12. 문의 및 권리 행사',
          paragraphs: [
            `약관, 결제, 소비자 권리, 분쟁 또는 규정 관련 문의는 ${koSupportRoute}를 통해 제출할 수 있습니다.`,
          ],
        },
      ],
    },
    refunds: {
      title: '환불 규정',
      subtitle:
        '이 규정은 Personal AI Stylist의 디지털 전용 소프트웨어 구매와 Polar를 통한 결제 및 환불 처리 기준을 설명합니다.',
      lastUpdated: '최종 업데이트: 2026년 3월 9일',
      sections: [
        {
          heading: '1. 적용 범위',
          paragraphs: [
            '이 서비스는 디지털 전용 AI 소프트웨어이며, 결제 후 디지털 액세스와 디지털 결과물 제공이 이루어집니다.',
            '이 환불 규정은 일반 기준을 설명하는 문서이며, 소비자의 거주 국가 또는 지역에서 강행적으로 보장하는 권리를 제한하지 않습니다.',
          ],
        },
        {
          heading: '2. 디지털 서비스와 즉시 제공',
          paragraphs: [
            '서비스는 결제 후 즉시 디지털 액세스 및 생성 기능을 제공하거나 재개할 수 있습니다.',
            '일부 국가에서는 디지털 콘텐츠 또는 디지털 서비스가 즉시 제공되는 경우, 법이 정한 절차와 동의가 있을 때 철회권이나 청약철회권이 제한될 수 있습니다. 반대로 현지 법률이 이를 허용하지 않거나 별도 권리를 보장하면 그 법률이 우선합니다.',
          ],
        },
        {
          heading: '3. 환불 또는 조정이 가능한 경우',
          paragraphs: [
            '다음과 같은 경우에는 관련 법률, 결제망 규칙 및 실제 상황을 종합해 환불 또는 결제 조정을 검토할 수 있습니다.',
          ],
          bullets: [
            '중복 결제 또는 명백한 과오금이 발생한 경우',
            '합리적인 재시도 후에도 기술적 문제로 약속된 디지털 결과를 제공하지 못한 경우',
            '무단 결제, 사기 결제, 결제 오류가 확인된 경우',
            '현지 소비자 보호법상 환불, 철회 또는 계약 해지가 인정되는 경우',
            '결제 후 내부 디지털 제공 실패가 발생하여 시스템 또는 운영자가 환불이 적절하다고 판단한 경우',
          ],
        },
        {
          heading: '4. 환불이 제한될 수 있는 경우',
          paragraphs: [
            '아래와 같은 경우에는 환불이 거절되거나 제한될 수 있습니다.',
          ],
          bullets: [
            '디지털 액세스와 요청한 생성 결과가 정상 제공된 뒤의 단순 변심',
            '취향, 미적 선호, 스타일 의견 차이만 있는 경우',
            '사용자가 권한 없는 사진, 손상된 사진, 부적절한 사진 또는 정책 위반 입력을 제공해 발생한 문제',
            '사용자가 결제 과정에서 이메일 주소를 잘못 입력해 결과 이메일을 받지 못한 경우',
            '서비스 남용, 결제 악용, 차지백 남용, 약관 위반이 확인된 경우',
          ],
        },
        {
          heading: '5. 지역별 소비자 권리',
          paragraphs: [
            'EEA, 영국, 스위스 및 기타 일부 지역의 소비자는 현지 법률에 따라 디지털 콘텐츠 또는 디지털 서비스 구매에 관한 추가 설명, 철회권, 하자보수 또는 환불 권리를 가질 수 있습니다.',
            '캘리포니아, 캐나다, 호주 및 기타 지역 소비자도 현지 소비자 보호법에 따라 별도의 강행 권리를 가질 수 있습니다. 본 규정은 그러한 강행 권리를 배제하지 않습니다.',
          ],
        },
        {
          heading: '6. 환불 요청 방법',
          paragraphs: [
            `환불 검토가 필요하면 구매 후 가능한 한 빠르게, 가급적 7일 이내에 ${koSupportRoute}를 통해 문의하세요.`,
            '주문 번호, 결제 이메일, 문제가 발생한 화면 또는 결과, 이미 시도한 해결 방법을 함께 보내면 검토가 빨라집니다.',
          ],
        },
        {
          heading: '7. 처리 방식과 기간',
          paragraphs: [
            '승인된 환불은 원래 결제 수단으로 반환됩니다. 실제 반영 시점은 Polar, 카드사, 은행 또는 현지 결제수단 처리 일정에 따라 달라질 수 있습니다.',
            '사기 또는 권한 확인이 필요한 경우, 추가 정보를 요청하거나 신원 확인을 요구할 수 있습니다.',
          ],
        },
        {
          heading: '8. 차지백 및 분쟁',
          paragraphs: [
            '차지백 또는 결제 분쟁이 제기되면 서비스 접근이 일시 제한될 수 있으며, 관련 거래에 대한 조사와 기록 보존이 이루어질 수 있습니다.',
            '문제가 있는 경우 먼저 지원 경로를 통해 해결을 시도하는 것이 가장 빠른 경우가 많습니다.',
          ],
        },
      ],
    },
    privacy: {
      title: '개인정보 처리방침',
      subtitle:
        '이 방침은 Personal AI Stylist가 사진, 신체 정보, 브라우저 저장 데이터, 생성 결과, 결제 메타데이터를 어떻게 처리하는지 설명합니다.',
      lastUpdated: '최종 업데이트: 2026년 3월 9일',
      sections: [
        {
          heading: '1. 적용 범위와 역할',
          paragraphs: [
            '이 방침은 서비스 사용 과정에서 서비스 운영자가 직접 통제하는 개인정보 처리에 적용됩니다.',
            '결제, 영수증, 세금, 결제 수단 정보의 일부는 Polar가 독립적인 제공자 또는 관련 역할의 사업자로서 별도 정책에 따라 처리할 수 있습니다.',
          ],
        },
        {
          heading: '2. 처리하는 정보 범주',
          paragraphs: [
            '서비스는 다음과 같은 정보를 처리할 수 있습니다.',
          ],
          bullets: [
            '업로드한 사진, 키, 몸무게, 언어 설정',
            '생성된 스타일 보고서, 헤어스타일 추천 이미지, 복사용 프롬프트',
            '주문 번호, 결제 상태, 구매 이메일, 환불 상태 같은 결제 관련 메타데이터',
            '브라우저 로컬 저장소에 저장되는 테마, 언어, 결제 확인 상태, 진행 중 생성 요청 정보',
            '기본 기술 로그, 오류 로그, 보안 로그, 요청 메타데이터',
          ],
        },
        {
          heading: '3. 수집 출처',
          bullets: [
            '사용자가 직접 업로드하거나 입력하는 정보',
            '브라우저와 기기에서 자동으로 생성되는 기술 정보',
            'Polar, Cloudflare, Google Gemini 같은 서비스 제공자로부터 전달되는 처리 결과 또는 메타데이터',
          ],
          paragraphs: [],
        },
        {
          heading: '4. 처리 목적',
          bullets: [
            '스타일 보고서, 헤어스타일 이미지, 프롬프트 등 요청한 디지털 결과를 생성하고 제공하기 위해',
            '결제 확인, 주문 처리, 환불 검토, 사기 방지, 보안 운영을 위해',
            '서비스 품질 개선, 오류 진단, 성능 모니터링, 분쟁 대응, 법적 의무 준수를 위해',
          ],
          paragraphs: [],
        },
        {
          heading: '5. 처리의 법적 근거',
          paragraphs: [
            '적용 법률이 요구하는 경우, 서비스는 일반적으로 계약 이행, 사용자의 요청 처리, 정당한 이익, 법적 의무 준수 또는 사용자의 동의를 근거로 개인정보를 처리합니다.',
            '사진과 입력 정보는 사용자가 요청한 스타일 결과를 생성하기 위해 주로 계약 이행 또는 요청 처리 근거로 처리됩니다. 결제 및 기록 보존은 법적 의무 또는 정당한 이익에 따라 처리될 수 있습니다.',
          ],
        },
        {
          heading: '6. 외부 처리자 및 국제 전송',
          paragraphs: [
            '서비스 운영을 위해 다음과 같은 외부 처리자를 사용할 수 있습니다.',
            '이들 제공자가 사용자의 거주 국가 밖에 위치하거나 국제 데이터 전송을 수행할 수 있습니다. 적용 법률이 요구하는 경우, 서비스는 계약 조항이나 기타 적절한 보호장치를 통해 전송을 정당화하려고 합니다.',
          ],
          bullets: [
            'Google Gemini: 스타일 보고서, 이미지 및 프롬프트 생성',
            'Cloudflare Pages/Workers: 호스팅, 서버 실행, 요청 처리, 보안',
            'Polar: 결제, 영수증, 세금, 환불 및 주문 관련 처리',
          ],
        },
        {
          heading: '7. 사진 및 AI 처리에 대한 추가 안내',
          paragraphs: [
            '업로드한 사진은 스타일 결과 생성 목적 범위에서 AI 처리에 사용됩니다. 현재 서비스는 사진을 얼굴 인식 기반 신원 확인, 생체 인증 또는 광고 프로파일링 목적으로 사용하려고 하지 않습니다.',
            '다만 사진은 외형, 건강 상태 추정, 인종·민족, 종교, 성별 표현 등 민감하거나 민감하게 해석될 수 있는 정보를 우연히 드러낼 수 있으므로, 필요하지 않은 민감한 사진은 업로드하지 않는 것이 좋습니다.',
          ],
        },
        {
          heading: '8. 쿠키 및 브라우저 저장소',
          paragraphs: [
            '현재 서비스는 테마, 언어, 결제 확인 상태, 결제 후 이어서 생성할 입력값 같은 기능적 목적을 위해 브라우저 로컬 저장소를 사용할 수 있습니다.',
            '현재 서비스 흐름에서는 사용자 정보를 교차 사이트 행동 광고에 판매하거나 공유하는 것을 의도하지 않습니다. 향후 광고나 분석 관행이 바뀌면 필요한 고지와 선택권을 별도로 제공해야 합니다.',
          ],
        },
        {
          heading: '9. 보관 기간',
          paragraphs: [
            '업로드 사진은 요청 처리에 필요한 범위에서만 사용하도록 설계되어 있으며, 서비스 운영자가 자체 장기 데이터베이스에 영구 저장하려는 목적은 현재 없습니다. 다만 로그, 캐시, 백업, 보안 기록, 외부 처리자 시스템에는 제한적으로 일시 보관될 수 있습니다.',
            '주문, 환불, 보안, 분쟁 대응, 회계 및 법적 의무와 관련된 정보는 관련 법률과 정당한 필요에 따라 더 오래 보관될 수 있습니다.',
          ],
        },
        {
          heading: '10. 이용자 권리',
          paragraphs: [
            '적용 법률에 따라 사용자는 자신의 개인정보에 대해 접근, 정정, 삭제, 처리 제한, 이의제기, 동의 철회, 데이터 이동 또는 불만 제기 권리를 가질 수 있습니다.',
            'EEA, 영국, 스위스, 캘리포니아 및 기타 지역 사용자에게는 현지법상 추가 권리가 있을 수 있으며, 서비스는 강행법이 부여하는 권리를 배제하지 않습니다.',
            `권리 행사 요청은 ${koSupportRoute}를 통해 제출할 수 있으며, 처리 전 합리적인 신원 확인이 필요할 수 있습니다.`,
          ],
        },
        {
          heading: '11. 자동화된 의사결정',
          paragraphs: [
            '서비스는 AI를 사용해 스타일 결과를 자동 생성하지만, 법적 효력이나 이에 준하는 중대한 영향을 주기 위한 자동화된 의사결정을 제공하려는 것이 아닙니다.',
            '사용자는 결과를 참고용으로 활용해야 하며, 중요한 결정은 사람의 판단과 추가 검토를 거쳐야 합니다.',
          ],
        },
        {
          heading: '12. 보안, 아동, 정책 변경',
          paragraphs: [
            '서비스는 합리적인 보안 조치를 적용하려고 하나, 인터넷 전송이나 저장 시스템이 절대적으로 안전하다고 보장할 수는 없습니다.',
            '서비스는 아동을 대상으로 하지 않으며, 아동의 개인정보를 고의로 수집하려고 하지 않습니다. 이러한 정보가 업로드된 사실을 알게 되면 적절한 조치를 취하려고 합니다.',
            '법률, 제품 구조, 처리 방식이 바뀌면 본 방침도 업데이트될 수 있으며, 중요한 변경은 합리적인 방식으로 고지됩니다.',
          ],
        },
      ],
    },
  },
  en: {
    terms: {
      title: 'Terms of Service',
      subtitle:
        'These terms govern the digital-only AI styling product Personal AI Stylist, including its generated outputs and Polar checkout flow.',
      lastUpdated: 'Last updated: March 9, 2026',
      sections: [
        {
          heading: '1. Scope of the service',
          paragraphs: [
            'Personal AI Stylist is a digital-only software product that generates body style reports, hairstyle recommendation images, and reusable prompts from user-submitted photos and body details.',
            'The service does not provide human consultation, offline styling appointments, salon services, physical goods, or any other entirely human service.',
          ],
        },
        {
          heading: '2. Eligibility and minors',
          paragraphs: [
            'The service is intended for adults or other users who can legally consent under the laws that apply to them.',
            'The service is not directed to children, and photos or information relating to children under 13 must not be uploaded. If a higher age threshold applies in your jurisdiction, that higher threshold controls.',
          ],
        },
        {
          heading: '3. User inputs and upload rights',
          paragraphs: [
            'You may upload only photos and information that you own or are legally authorized to use.',
          ],
          bullets: [
            'Do not upload content that infringes the rights of others or that you are not authorized to submit.',
            'Do not upload unnecessary sensitive data, government identification numbers, financial data, detailed health data, or photos of minors.',
            'You may not use the service for illegal, harmful, deceptive, abusive, infringing, discriminatory, or payment-network-prohibited activity.',
          ],
        },
        {
          heading: '4. AI outputs and user responsibility',
          paragraphs: [
            'Reports, images, prompts, and other outputs are generated automatically by AI. Outputs may be incomplete, subjective, or imperfect and are provided for inspiration and informational use only.',
          ],
          bullets: [
            'Outputs are not medical, legal, financial, employment, mental health, or other professional advice.',
            'You remain responsible for reviewing recommendations before making purchases, appearance changes, publication decisions, or commercial uses.',
            'Output quality depends in part on source-image quality, angle, lighting, visibility, and the accuracy of your submitted details.',
          ],
        },
        {
          heading: '5. Payments, taxes, and digital supply',
          paragraphs: [
            'Payments are processed through Polar, which may act as Merchant of Record or reseller for relevant orders.',
            'Pricing, currency, taxes, receipts, fraud screening, payment verification, and certain refund handling may therefore be managed through Polar, applicable law, and payment-network rules.',
            'Once payment is verified, digital access and requested generation flows may begin or resume. Nothing in these terms limits mandatory consumer rights that apply under your local law.',
          ],
        },
        {
          heading: '6. Refunds and withdrawal rights',
          paragraphs: [
            'Refund handling is described in the separate Refund Policy. Statutory withdrawal, cancellation, cooling-off, or digital-content rights under local law continue to apply to the extent required by that law.',
            'Where local law permits immediate digital supply and a valid consent or waiver mechanism is used, some withdrawal rights may be reduced or lost once supply begins.',
          ],
        },
        {
          heading: '7. Prohibited use',
          paragraphs: [
            'You may not use the service in ways that exceed its permitted digital styling purpose.',
          ],
          bullets: [
            'Do not present the product as human consultation, medical advice, or a service for children.',
            'Do not resell raw access, clone the service, redistribute it without authorization, or repackage it as a bulk automated output service.',
            'Do not attempt security bypass, reverse engineering, abusive automation, payment abuse, malicious uploads, or excessive traffic that harms the platform.',
          ],
        },
        {
          heading: '8. Intellectual property and license',
          paragraphs: [
            'You retain rights in your lawful uploaded inputs to the extent those rights exist. You grant the service a limited license to process those inputs as needed to operate the product and generate outputs.',
            'The software, interface, operational logic, brand assets, and related intellectual property remain owned by the service operator or its licensors.',
          ],
          bullets: [
            'Generated outputs are provided on a limited, non-exclusive basis for your personal or internal reference use.',
            'You may not resell the service itself, transfer raw access rights, or market the product as a human stylist or consulting service performed by our team.',
          ],
        },
        {
          heading: '9. Privacy and international processing',
          paragraphs: [
            'Your use of the service is also governed by the Privacy Policy. The service may rely on Cloudflare, Google Gemini, Polar, and similar providers, which can involve cross-border data processing.',
            'The service is not intended to use uploaded photos for identity verification, facial recognition enrollment, or biometric authentication. Photos are processed for styling-output generation only.',
          ],
        },
        {
          heading: '10. Availability, changes, and suspension',
          paragraphs: [
            'Features, models, pricing, and supported functionality may change over time. Access may be limited, modified, or suspended for maintenance, security, payment disputes, legal compliance, or third-party service constraints.',
            'We may update the service and these terms from time to time. Material changes will be communicated in a reasonable way.',
          ],
        },
        {
          heading: '11. Mandatory local law and liability',
          paragraphs: [
            'If mandatory consumer, privacy, e-commerce, or other local laws in your jurisdiction conflict with these terms, those mandatory laws control to the extent of the conflict.',
            'To the maximum extent permitted by law, the service is provided on an as-is basis without guarantees of uninterrupted availability or specific results. To the maximum extent permitted by law, liability is limited to the amount paid for the affected purchase.',
          ],
        },
        {
          heading: '12. Contact and rights requests',
          paragraphs: [
            `Questions about these terms, payments, disputes, or consumer-rights issues may be sent through ${enSupportRoute}.`,
          ],
        },
      ],
    },
    refunds: {
      title: 'Refund Policy',
      subtitle:
        'This policy describes refund handling for Personal AI Stylist purchases made as digital-only software orders through Polar.',
      lastUpdated: 'Last updated: March 9, 2026',
      sections: [
        {
          heading: '1. Scope',
          paragraphs: [
            'This product provides digital-only AI access and digital outputs. This Refund Policy explains our general approach and does not override any mandatory rights you may have under local law.',
          ],
        },
        {
          heading: '2. Immediate digital supply',
          paragraphs: [
            'After payment is confirmed, the service may immediately provide or resume digital access and generation features.',
            'In some countries, digital-content or digital-service withdrawal rights can be reduced or lost after supply begins if the law allows that and the required consent or acknowledgment has been obtained. If your local law provides stronger protection, that law controls.',
          ],
        },
        {
          heading: '3. When refunds or adjustments may be available',
          paragraphs: [
            'Refunds or payment adjustments may be considered based on applicable law, payment-network rules, and the facts of the transaction.',
          ],
          bullets: [
            'Duplicate charges or obvious overcharges',
            'A technical failure that prevents delivery of the promised digital output after reasonable retry attempts',
            'Verified unauthorized or fraudulent charges',
            'Any situation where a refund, reversal, or cancellation right is required by law',
            'Internal fulfillment failure after payment where a refund is the appropriate remedy',
          ],
        },
        {
          heading: '4. When refunds may be limited or denied',
          paragraphs: [
            'Refund requests may be denied or limited in situations such as the following.',
          ],
          bullets: [
            'A change of mind after digital access and requested output delivery have already succeeded',
            'Purely subjective dissatisfaction with style taste or visual preference after outputs were delivered',
            'Problems caused by unsupported, low-quality, unauthorized, or policy-violating source images or inputs',
            'Failure to receive the emailed result because the buyer entered an incorrect email address during checkout',
            'Abuse of the service, payment abuse, chargeback abuse, or violation of the Terms of Service',
          ],
        },
        {
          heading: '5. Regional consumer rights',
          paragraphs: [
            'Consumers in the EEA, the UK, Switzerland, California, Canada, Australia, and other regions may have additional statutory rights relating to digital content, digital services, withdrawals, cancellations, or faulty service delivery.',
            'Nothing in this policy is intended to waive rights that cannot legally be waived in your jurisdiction.',
          ],
        },
        {
          heading: '6. How to request a refund review',
          paragraphs: [
            `If you believe a refund review is appropriate, contact us as soon as reasonably possible, ideally within 7 days of purchase, through ${enSupportRoute}.`,
            'Please include your order ID, purchase email, a short description of the issue, and any troubleshooting steps already taken.',
          ],
        },
        {
          heading: '7. Processing and timing',
          paragraphs: [
            'Approved refunds are returned to the original payment method through Polar. Final posting times depend on Polar, your bank, card issuer, or local payment provider.',
            'We may request additional information where necessary to confirm identity, investigate fraud, or validate the issue.',
          ],
        },
        {
          heading: '8. Chargebacks and disputes',
          paragraphs: [
            'If a chargeback or payment dispute is opened, access to the service may be restricted while the matter is reviewed.',
            'In many cases, contacting support first is the fastest way to resolve a legitimate issue without escalating to a formal dispute.',
          ],
        },
      ],
    },
    privacy: {
      title: 'Privacy Policy',
      subtitle:
        'This policy explains how Personal AI Stylist handles uploaded photos, body details, generated outputs, browser storage, and payment-related metadata.',
      lastUpdated: 'Last updated: March 9, 2026',
      sections: [
        {
          heading: '1. Scope and roles',
          paragraphs: [
            'This Privacy Policy applies to personal information that the service operator controls in connection with the product.',
            'Polar may separately process payment, receipt, tax, and payment-method information under its own policies where it acts as a payment provider, Merchant of Record, or related service provider.',
          ],
        },
        {
          heading: '2. Categories of information we process',
          paragraphs: [
            'We may process the following categories of information.',
          ],
          bullets: [
            'Uploaded photos, height, weight, and language preferences',
            'Generated style reports, hairstyle recommendation images, and reusable prompts',
            'Order IDs, payment status, purchase email, refund status, and related payment metadata',
            'Browser-stored settings and workflow state, such as theme, language, payment verification status, and pending generation inputs',
            'Basic technical logs, security logs, request metadata, and error information',
          ],
        },
        {
          heading: '3. Sources of information',
          bullets: [
            'Information you upload or enter directly',
            'Technical information created by your browser, device, or network during service use',
            'Metadata or processing results received from service providers such as Polar, Cloudflare, and Google Gemini',
          ],
          paragraphs: [],
        },
        {
          heading: '4. Purposes of processing',
          bullets: [
            'To generate and deliver requested style reports, hairstyle results, and related prompts',
            'To verify payments, process orders, review refunds, prevent fraud, and secure the platform',
            'To diagnose errors, improve reliability, investigate abuse, comply with legal obligations, and resolve disputes',
          ],
          paragraphs: [],
        },
        {
          heading: '5. Legal bases',
          paragraphs: [
            'Where applicable law requires a legal basis, we generally rely on contract performance, responding to your request, legitimate interests, legal compliance, or consent, depending on the context.',
            'Photos and body details are mainly processed so that we can provide the digital styling output you requested. Payment and record-keeping information may also be processed to comply with legal obligations or to protect legitimate interests such as fraud prevention and dispute handling.',
          ],
        },
        {
          heading: '6. Service providers and international transfers',
          paragraphs: [
            'We use third-party providers to operate the service, including the following.',
            'These providers may process information outside your country of residence. Where required by law, we rely on appropriate safeguards for cross-border transfers, such as contractual protections or other lawful transfer mechanisms.',
          ],
          bullets: [
            'Google Gemini for AI generation',
            'Cloudflare Pages/Workers for hosting, server execution, delivery, and security',
            'Polar for checkout, receipts, taxes, payment handling, and refund-related processing',
          ],
        },
        {
          heading: '7. Photo and AI-processing notice',
          paragraphs: [
            'Uploaded photos are processed for style-output generation. The service is not intended to use those photos for facial recognition enrollment, identity verification, or biometric authentication.',
            'Photos may nonetheless incidentally reveal sensitive or potentially sensitive characteristics. Please avoid uploading images that contain unnecessary sensitive information.',
          ],
        },
        {
          heading: '8. Cookies and browser storage',
          paragraphs: [
            'The current service flow uses browser-local storage for functional purposes such as remembering language, theme, checkout verification state, and pending generation requests.',
            'In the current service flow, we do not intend to sell or share personal information for cross-context behavioral advertising. If our data practices materially change, we would need to provide any additional disclosures or controls required by law.',
          ],
        },
        {
          heading: '9. Retention',
          paragraphs: [
            'Uploaded photos are intended to be used only as needed to process the request, and the current app flow is not designed to keep them in our own long-term database for unrelated purposes. However, limited temporary retention can still occur in caches, logs, backups, security systems, or third-party processor systems.',
            'Order, refund, fraud-prevention, accounting, and dispute-related records may be retained for longer periods where reasonably necessary or legally required.',
          ],
        },
        {
          heading: '10. Your rights',
          paragraphs: [
            'Depending on your location, you may have rights to request access, correction, deletion, restriction, objection, portability, withdrawal of consent, or complaint filing regarding personal information.',
            'Users in the EEA, UK, Switzerland, California, and other regions may have additional statutory rights. Nothing in this policy limits non-waivable rights under applicable law.',
            `Rights requests may be submitted through ${enSupportRoute}. We may take reasonable steps to verify identity before acting on a request.`,
          ],
        },
        {
          heading: '11. Automated decision-making',
          paragraphs: [
            'The service uses AI to generate style-related content automatically, but it is not intended to make decisions with legal or similarly significant effects about you.',
            'Important decisions should be reviewed by a human and not made solely on the basis of generated outputs.',
          ],
        },
        {
          heading: '12. Security, minors, and policy updates',
          paragraphs: [
            'We apply reasonable technical and organizational measures to protect information, but no internet transmission or storage system can be guaranteed to be completely secure.',
            'The service is not intended for children, and we do not intend to knowingly collect children’s personal information. If we learn that such information has been submitted, we will take appropriate steps.',
            'We may update this Privacy Policy if laws, service architecture, or processing practices change. Material changes will be communicated in a reasonable way.',
          ],
        },
      ],
    },
  },
}
