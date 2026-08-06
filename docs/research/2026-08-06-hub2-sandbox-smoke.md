# Hub2 sandbox smoke — 2026-08-06

First run 21:07 UTC reached terminal "completed" (intent pi_J_yw07ItWLlIObcNlxti2). Recorded run below.

```
[smoke-hub2] Starting sandbox smoke — initiating payment...
[smoke-hub2] initiatePayment response: {
  "providerReference": "pi_yV4SCH7ChIbKWZ3DEEqNT",
  "paymentUrl": "",
  "status": "processing",
  "raw": {
    "intent": {
      "amount": 100,
      "createdAt": "2026-08-06T21:07:52.177Z",
      "currency": "XOF",
      "customerReference": "smoke@example.com",
      "id": "pi_yV4SCH7ChIbKWZ3DEEqNT",
      "merchantId": "FDVfrtUKNcYCSDwyqnAVY",
      "mode": "sandbox",
      "payments": [],
      "purchaseReference": "2a503bf5-b7b0-42f1-abfa-86ce2c3cb1c2",
      "status": "payment_required",
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpbnRlbnRJZCI6InBpX3lWNFNDSDdDaEliS1daM0RFRXFOVCIsIm1lcmNoYW50SWQiOiJGRFZmcnRVS05jWUNTRHd5cW5BVlkiLCJtb2RlIjoic2FuZGJveCIsImlhdCI6MTc4NjA1MDQ3Mn0.BzV62U0iREMsq7RqADMwWN0YIKpJLQRoLjYzJB9VwIc",
      "updatedAt": "2026-08-06T21:07:52.177Z"
    },
    "attempt": {
      "amount": 100,
      "createdAt": "2026-08-06T21:07:52.177Z",
      "currency": "XOF",
      "customerReference": "smoke@example.com",
      "id": "pi_yV4SCH7ChIbKWZ3DEEqNT",
      "merchantId": "FDVfrtUKNcYCSDwyqnAVY",
      "mode": "sandbox",
      "overrideBusinessName": "",
      "payments": [
        {
          "amount": 100,
          "country": "CI",
          "createdAt": "2026-08-06T21:07:52.292Z",
          "currency": "XOF",
          "fees": [
            {
              "amount": 5,
              "currency": "XOF",
              "id": "fee_yQuqb5X6Hy7lz3NC1BKGs",
              "label": "",
              "rate": 5,
              "rateType": "percent",
              "taxes": [
                {
                  "feeId": "fee_yQuqb5X6Hy7lz3NC1BKGs",
                  "id": "tax_ObUq6QuUEO17yOogo2tcx",
                  "taxType": "tva",
                  "type": "percent",
                  "value": 0.7627118644067794
                }
              ]
            }
          ],
          "id": "pay_1lu4a460ieXcojI6mSqPv",
          "intentId": "pi_yV4SCH7ChIbKWZ3DEEqNT",
          "method": "mobile_money",
          "number": "00000001",
          "provider": "mtn",
          "status": "created",
          "updatedAt": "2026-08-06T21:07:52.292Z",
          "gatewayId": ""
        }
      ],
      "purchaseReference": "2a503bf5-b7b0-42f1-abfa-86ce2c3cb1c2",
      "status": "processing",
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpbnRlbnRJZCI6InBpX3lWNFNDSDdDaEliS1daM0RFRXFOVCIsIm1lcmNoYW50SWQiOiJGRFZmcnRVS05jWUNTRHd5cW5BVlkiLCJtb2RlIjoic2FuZGJveCIsImlhdCI6MTc4NjA1MDQ3Mn0.BzV62U0iREMsq7RqADMwWN0YIKpJLQRoLjYzJB9VwIc",
      "updatedAt": "2026-08-06T21:07:52.177Z"
    }
  }
}
[smoke-hub2] Polling verifyPayment for intent pi_yV4SCH7ChIbKWZ3DEEqNT (up to 60s)...
[smoke-hub2] poll 1/12 — verifyPayment response: {
  "providerReference": "pi_yV4SCH7ChIbKWZ3DEEqNT",
  "status": "completed",
  "amount": 100,
  "currency": "XOF",
  "paymentMethod": "HUB2",
  "raw": {
    "id": "pi_yV4SCH7ChIbKWZ3DEEqNT",
    "createdAt": "2026-08-06T21:07:52.177Z",
    "updatedAt": "2026-08-06T21:07:52.408Z",
    "merchantId": "FDVfrtUKNcYCSDwyqnAVY",
    "purchaseReference": "2a503bf5-b7b0-42f1-abfa-86ce2c3cb1c2",
    "customerReference": "smoke@example.com",
    "amount": 100,
    "currency": "XOF",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpbnRlbnRJZCI6InBpX3lWNFNDSDdDaEliS1daM0RFRXFOVCIsIm1lcmNoYW50SWQiOiJGRFZmcnRVS05jWUNTRHd5cW5BVlkiLCJtb2RlIjoic2FuZGJveCIsImlhdCI6MTc4NjA1MDQ3Mn0.BzV62U0iREMsq7RqADMwWN0YIKpJLQRoLjYzJB9VwIc",
    "status": "successful",
    "overrideBusinessName": "",
    "payments": [
      {
        "id": "pay_1lu4a460ieXcojI6mSqPv",
        "intentId": "pi_yV4SCH7ChIbKWZ3DEEqNT",
        "createdAt": "2026-08-06T21:07:52.292Z",
        "updatedAt": "2026-08-06T21:07:52.407Z",
        "amount": 100,
        "currency": "XOF",
        "status": "successful",
        "method": "mobile_money",
        "country": "CI",
        "provider": "mtn",
        "number": "00000001",
        "fees": [
          {
            "currency": "XOF",
            "id": "fee_yQuqb5X6Hy7lz3NC1BKGs",
            "label": "",
            "rate": 5,
            "rateType": "percent",
            "amount": 5,
            "taxes": [
              {
                "id": "tax_ObUq6QuUEO17yOogo2tcx",
                "feeId": "fee_yQuqb5X6Hy7lz3NC1BKGs",
                "taxType": "tva",
                "type": "percent",
                "value": "0.7627118644067794"
              }
            ]
          }
        ],
        "isDelegated": false,
        "paymentInformation": null
      }
    ],
    "mode": "sandbox"
  }
}
[smoke-hub2] Terminal status "completed" reached — done.
[smoke-hub2] Smoke script finished.
EXIT=0
```
