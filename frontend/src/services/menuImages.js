import poha from "../assets/menu-poha.webp";
import paneer from "../assets/menu-paneer.webp";
import sabzi from "../assets/menu-sabzi.webp";
import dal from "../assets/menu-dal.webp";
import thali from "../assets/thali.png";

// Match the main dish first: sides such as rice or dal should not override paneer.
const dishes = [
  { pattern: /\b(poha|pohe|flattened rice)\b|पोहा/i, src: poha, label: "Poha with masala chai and fruit" },
  { pattern: /\b(paneer|panir)\b|पनीर/i, src: paneer, label: "Paneer curry with rice and roti" },
  { pattern: /\b(sabzi|sabji|subzi|vegetable|veggies|aloo|gobi)\b|सब्जी|सब्ज़ी/i, src: sabzi, label: "Vegetable sabzi with dal and rice" },
  { pattern: /\b(dal|daal|dahl|lentils?)\b|दाल/i, src: dal, label: "Dal tadka with rice and roti" },
  { pattern: /\b(thali|indian platter)\b|थाली/i, src: thali, label: "Indian vegetarian thali" },
];

export function menuImage(description = "") {
  return dishes.find(dish => dish.pattern.test(description)) || null;
}

