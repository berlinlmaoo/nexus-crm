import { redirect } from "next/navigation";

/**
 * Bikin PO langsung udah nggak ada.
 *
 * Pengadaan sekarang selalu mulai dari Purchase Request: tiap head ngajuin kebutuhannya, terus
 * Manager/Owner milih mana yang jadi pesanan. Kalau pintu "bikin PO langsung" dibiarin kebuka,
 * pesanan bisa muncul tanpa ada yang pernah mintanya — dan papan request-nya jadi bohong.
 *
 * Dialihin, bukan dihapus, biar tautan lama (bookmark, tombol yang kelewat) nggak mentok 404.
 */
export default function PurchasingNewRedirect() {
  redirect("/purchase-requests");
}
