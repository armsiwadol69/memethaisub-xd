# TODO

- กรองข้อมูลเพลงโดยมีเงื่อนไขแยกตามเกมดังนี้
- maimai เฉพาะ category "maimai" และ "niconico＆ボーカロイド"
- CHUNITHM เฉพาะ category "niconico" และ "ゲキマイ"

- จากนั้นเราอยากรู้ว่า มีเพลงไหนบ้างในแต่ละเกม ที่คัดออกมา มีอยู่ใน Channel Youtube ที่เราอยากรู้ ทั้งนี้ชื่อเพลงของคลิป Youtube นั้น อาจจะไม่ตรงกับชื่อเพลงใน Data ที่เอามา เช่น อาจจะเป็น Rommaji / Kanji หรืออื่นๆมันคือเพลงเดียวกัน
- ถ้ามีเพลงใน Channel Youtube ที่คัดออกมาแล้ว ให้ทำ JSON หรือ อะไรก็ได้ที่สามารถนำข้อมูลไปใช้งานต่อได้ง้่นๆ
- ท้ายสุดเราอยากได้ single page web app ที่สามารถแสดงข้อมูลได้ สามารถค้าหาเพลงต่างๆ กรองเพลงตามเกม ตามหมวดหมู่ ตา่มระดับความยากได้
- รูปไม่ให้ใช้ Hotlink ให้ Download มาไว้ในนี้เลย

- เรามี Local AI (Ollama) อยู่บน Server นายสามารถทำ .env ให้เรากรอก API URL ได้ หากต้องการใช้งาน ในการช่วยจำแนก

- เน้นใช้ Node.js / Next.js / TS พวกนี้เป็นหลัก เน้นให้สามารถ Deploy Final Product ได้บน Cloudfare 

- จะให้เราให้ข้อมูล Youtube ที่เราต้องการเทียบ ยังไงก็บอกเราละกัน หรือสามารถเรียก API ได้ บอกเรามาเลย


# Image URL

## maimai

https://dp4p6x0xfi5o9.cloudfront.net/maimai/img/cover/{imageName}

## CHUNITHM

https://dp4p6x0xfi5o9.cloudfront.net/chunithm/img/cover/{imageName}