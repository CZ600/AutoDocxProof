# -*- coding: utf-8 -*-
"""
对照测试：doubao-embedding-large-text-250515
1) 标准 openai SDK 调用（和软件当前方式最接近）
2) 原始 HTTP 请求（手动构造，便于查看完整请求/响应头）
"""
import json
import urllib.request
import urllib.error
from openai import OpenAI

API_KEY = "8e9a3929-53cd-4362-9ee7-5d0b03b55514"
BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"
MODEL = "doubao-embedding-large-text-250515"

print("=" * 60)
print("Test 1: openai SDK (与软件当前调用方式一致)")
print("=" * 60)
client = OpenAI(api_key=API_KEY, base_url=BASE_URL)
try:
    resp = client.embeddings.create(
        model=MODEL,
        input=["hello world"],
        encoding_format="float",
    )
    print("OK, dim =", len(resp.data[0].embedding))
    print("first 5:", resp.data[0].embedding[:5])
except Exception as e:
    print("FAILED:", type(e).__name__, str(e)[:400])

print()
print("=" * 60)
print("Test 2: 原生 HTTP (urllib)，查看完整错误响应")
print("=" * 60)
def raw_http(url, payload):
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read().decode("utf-8"))
            print("HTTP", r.status, "OK")
            if "data" in data:
                print("dim =", len(data["data"][0]["embedding"]))
                print("first 5:", data["data"][0]["embedding"][:5])
            else:
                print("resp keys:", list(data.keys()))
    except urllib.error.HTTPError as e:
        print("HTTP", e.code)
        try:
            err = json.loads(e.read().decode("utf-8"))
            print("error body:", json.dumps(err, ensure_ascii=False)[:500])
        except Exception:
            print("error body (raw):", e.read()[:500])

# 2a: 标准文本端点
print("\n[2a] /embeddings (text endpoint)")
raw_http(f"{BASE_URL}/embeddings", {"model": MODEL, "input": ["hello world"], "encoding_format": "float"})

# 2b: 多模态端点（对象数组）
print("\n[2b] /embeddings/multimodal (object array input)")
raw_http(f"{BASE_URL}/embeddings/multimodal", {
    "model": MODEL,
    "encoding_format": "float",
    "input": [{"type": "text", "text": "hello world"}],
})
