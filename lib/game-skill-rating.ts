import type {TriadCard} from './triad-dominion';
// Reviewed card-number assignments, not guesses based on flavor-text keywords.
const groups:Record<number,string[]>={
 1:['266','280'],
 2:['216','218','221','224','228','231','233','237','243','246','252','256','260','262','267','269','273','275','279','282','283','287'],
 3:['016','017','018','019','020','219','223','225','229','230','232','234','235','238','240','247','248','250','251','255','268','270','272','276','277','278','281','285','291','293'],
 4:['220','222','226','241','244','253','257','261','263','264','271','286','288','289','290','292'],
 5:['001','002','003','004','005','217','227','236','239','242','245','249','254','258','259','265','274','284'],
};
export const skillRatingVersion=1;
export const skillRatingReasons:Record<number,string>={1:'ผลเดี่ยวขนาดเล็ก ลด 1,000 หรือเพิ่มแบบมีเงื่อนไข',2:'บัฟ/ลดพลังเฉพาะเป้าหมาย หรือป้องกันแบบจำกัด',3:'เปลี่ยนพลังราว 4,000–5,000 หรือพลิกบทบาทแบบมีเงื่อนไข',4:'ส่งผลหลายเป้าหมายหรือสร้างคอมโบควบคุมสนาม',5:'เปลี่ยนจังหวะเกม: ยึดการควบคุม ยกเลิกสกิล เปิดสกิลเพิ่ม รีเซ็ตพลัง หรือผลวงกว้างรุนแรง'};
const ratings=new Map(Object.entries(groups).flatMap(([stars,ids])=>ids.map(id=>[id,Number(stars)] as const)));
export function rateGameSkill(card:TriadCard){
 const stars=ratings.get(card.cardNo);
 if(card.kind!=='skill'||!stars)throw Error('Unreviewed skill rating: '+card.cardNo);
 return {stars,reason:skillRatingReasons[stars],version:skillRatingVersion};
}
