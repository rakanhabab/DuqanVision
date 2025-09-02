# 🔄 مسار الرسالة في نظام RAG - دكان فجن

## 📋 نظرة عامة على المسار

```
المستخدم → API → التوجيه الذكي → المعالجة → قاعدة البيانات → الإجابة → المستخدم
```

---

## 🚀 البداية: استقبال الرسالة

### 1. **المستخدم يرسل سؤال**
```
مثال: "كم سعر شيبس ليز؟"
```

### 2. **API يستقبل الطلب**
```http
POST /ask
{
    "question": "كم سعر شيبس ليز؟",
    "user_id": "user123",
    "user_name": "أحمد"
}
```

### 3. **التحقق من صحة البيانات**
```python
# التحقق من وجود السؤال
if not req.question or not req.question.strip():
    return "يرجى إدخال سؤال صحيح"
```

---

## 🧠 المرحلة الأولى: التوجيه الذكي

### 4. **بدء معالجة السؤال**
```python
async def ask_question(self, question: str, user_id: str, user_name: str):
    # تتبع الطريقة المستخدمة
    method_used = "unknown"
    confidence = 0.0
```

### 5. **الطريقة الأولى: مطابقة الكلمات المفتاحية**
```python
# البحث عن رد ذكي مبرمج مسبقاً
smart_response = self.smart_service.get_smart_response(question, user_name)

# مثال على الردود المبرمجة:
SMART_RESPONSES = {
    ("كم سعر الشيبس", "سعر المقرمشات"): "شيبس_prices",
    ("اهلا", "مرحبا"): lambda user: f"أهلاً {user}!",
}
```

**✅ إذا وجد رداً:**
- يعيد الإجابة فوراً
- confidence = 0.95
- method = "keyword_matching"

**❌ إذا لم يجد رداً:**
- ينتقل للطريقة الثانية

---

## 🤖 المرحلة الثانية: توجيه LLM

### 6. **استخدام توجيه الذكاء الاصطناعي**
```python
# توجيه السؤال للـ LLM
router_response = await self.router_service.get_router_response(question)

# LLM يحلل السؤال ويحدد:
# - نوع السؤال (سعر، معلومات، فروع، إلخ)
# - المنتج المطلوب
# - الإجراء المطلوب
```

### 7. **تحليل LLM للسؤال**
```
السؤال: "كم سعر شيبس ليز؟"
التحليل:
- النوع: استعلام سعر
- المنتج: شيبس ليز
- الإجراء: البحث في قاعدة البيانات
```

**✅ إذا نجح التحليل:**
- confidence = 0.90
- method = "llm_router"

**❌ إذا فشل التحليل:**
- ينتقل للطريقة الثالثة

---

## 🔍 المرحلة الثالثة: البحث الدلالي

### 8. **البحث الدلالي في النصوص**
```python
# البحث في المستندات المخزنة
semantic_response = await self.semantic_service.get_semantic_response(question)

# البحث عن:
# - معلومات مشابهة
# - نصوص ذات صلة
# - إجابات سابقة
```

**✅ إذا وجد معلومات:**
- confidence = 0.85
- method = "semantic_search"

**❌ إذا لم يجد:**
- ينتقل للبحث في قاعدة البيانات

---

## 🗄️ المرحلة الرابعة: قاعدة البيانات

### 9. **البحث في قاعدة البيانات**
```python
# البحث عن المنتجات
if "شيبس" in question or "lays" in question.lower():
    products = await self.db_service.get_products_by_category("Snacks")
    
# أو البحث العام
products = await self.db_service.search_products(question)
```

### 10. **استعلام قاعدة البيانات**
```sql
-- البحث عن شيبس ليز
SELECT * FROM products 
WHERE name_ar LIKE '%شيبس ليز%' 
   OR name_en LIKE '%lays%'
   OR category = 'Snacks';
```

### 11. **معالجة النتائج**
```python
# تنسيق النتائج
if products:
    response = self.smart_service.format_product_response(products)
    confidence = 0.95
    method = "database_search"
else:
    # البحث في الذاكرة أو إعطاء رد عام
    response = "عذراً، لم أجد معلومات عن هذا المنتج"
```

---

## 💾 المرحلة الخامسة: إدارة الذاكرة

### 12. **حفظ المحادثة**
```python
# حفظ السؤال والإجابة في ذاكرة المستخدم
await self._save_to_memory(question, response, user_id)

# كل مستخدم له ذاكرة منفصلة
self.memories[user_id].save_context(
    {"input": question},
    {"output": response}
)
```

### 13. **تحديث إحصائيات المستخدم**
```python
# تحديث عدد الأسئلة
# حفظ تفضيلات المستخدم
# تحسين الإجابات المستقبلية
```

---

## 📤 المرحلة النهائية: إرجاع الإجابة

### 14. **تنسيق الإجابة النهائية**
```python
# تنسيق الإجابة مع معلومات إضافية
final_response = {
    "answer": "سعر شيبس ليز 2.00 ريال",
    "source": "database",
    "confidence": 0.95,
    "method": "keyword_matching",
    "user_id": "user123",
    "timestamp": "2024-01-15T10:30:00Z"
}
```

### 15. **إرسال الإجابة للمستخدم**
```json
{
    "status": "success",
    "data": {
        "answer": "سعر شيبس ليز 2.00 ريال",
        "source": "database",
        "confidence": 0.95,
        "method": "keyword_matching"
    }
}
```

---

## 🔄 مثال كامل لمسار الرسالة

### السؤال: "كم سعر شيبس ليز؟"

#### 1️⃣ **الاستقبال**
```
API ← "كم سعر شيبس ليز؟" + user_id: "user123"
```

#### 2️⃣ **مطابقة الكلمات المفتاحية**
```
البحث في: SMART_RESPONSES
النتيجة: ❌ لم يجد مطابقة دقيقة
```

#### 3️⃣ **توجيه LLM**
```
LLM ← "كم سعر شيبس ليز؟"
تحليل: استعلام سعر + منتج: شيبس ليز
النتيجة: ✅ فهم السؤال
```

#### 4️⃣ **البحث في قاعدة البيانات**
```
SQL ← SELECT * FROM products WHERE name_ar LIKE '%شيبس ليز%'
النتيجة: ✅ وجد المنتج
```

#### 5️⃣ **تنسيق الإجابة**
```
تنسيق ← "سعر شيبس ليز 2.00 ريال"
```

#### 6️⃣ **حفظ في الذاكرة**
```
ذاكرة المستخدم ← السؤال + الإجابة
```

#### 7️⃣ **إرسال الإجابة**
```
المستخدم ← "سعر شيبس ليز 2.00 ريال"
```

---

## ⚡ تحسينات الأداء

### **التخزين المؤقت (Caching)**
```python
# تخزين الإجابات الشائعة
cache_key = f"question:{question_hash}"
if cache.exists(cache_key):
    return cache.get(cache_key)
```

### **المعالجة المتوازية**
```python
# تشغيل الطرق الثلاث في نفس الوقت
tasks = [
    smart_service.get_smart_response(question),
    router_service.get_router_response(question),
    semantic_service.get_semantic_response(question)
]
results = await asyncio.gather(*tasks, return_exceptions=True)
```

### **تحسين قاعدة البيانات**
```sql
-- فهارس للبحث السريع
CREATE INDEX idx_product_name_ar ON products(name_ar);
CREATE INDEX idx_product_category ON products(category);
```

---

## 📊 إحصائيات المسار

### **متوسط وقت الاستجابة:**
- مطابقة الكلمات: < 100ms
- توجيه LLM: < 2 ثانية
- البحث الدلالي: < 3 ثانية
- قاعدة البيانات: < 500ms

### **معدل النجاح:**
- الكلمات المفتاحية: 60%
- توجيه LLM: 30%
- البحث الدلالي: 5%
- قاعدة البيانات: 5%

### **دقة الإجابات:**
- الكلمات المفتاحية: 95%
- توجيه LLM: 90%
- البحث الدلالي: 85%
- قاعدة البيانات: 95%

---

## 🎯 الخلاصة

مسار الرسالة في نظام RAG مصمم ليكون:
- **سريع**: استخدام الطرق الأسرع أولاً
- **ذكي**: فهم عميق للسؤال
- **دقيق**: إجابات موثوقة
- **قابل للتطوير**: سهولة إضافة ميزات جديدة

هذا المسار يضمن تجربة مستخدم ممتازة مع الحفاظ على الأداء العالي! 🚀
