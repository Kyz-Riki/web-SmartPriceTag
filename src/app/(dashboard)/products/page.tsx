"use client";

import { useEffect, useState } from "react";
import { listenTags, updateTag, toggleTagStatus, deleteTag } from "@/lib/tags";
import type { Tag, TagsRecord } from "@/types";
import { formatRelative } from "date-fns";
import { id } from "date-fns/locale";
import { Tags, Pencil, Power, X, Loader2, AlertCircle, Trash2 } from "lucide-react";

export default function ProductsPage() {
  const [tags, setTags] = useState<TagsRecord>({});
  
  // Modal states
  const [selectedTag, setSelectedTag] = useState<{ uid: string; tag: Tag } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editProductName, setEditProductName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = listenTags(setTags);
    return () => unsub();
  }, []);

  function handleOpenEdit(uid: string, tag: Tag) {
    setSelectedTag({ uid, tag });
    setEditProductName(tag.product_name);
    setEditPrice(tag.price.toString());
    setModalOpen(true);
    setError(null);
  }

  function handleCloseModal() {
    setModalOpen(false);
    setSelectedTag(null);
    setEditProductName("");
    setEditPrice("");
  }

  async function handleToggleStatus(uid: string, currentStatus: boolean) {
    const action = currentStatus ? "menonaktifkan (terjual)" : "mengaktifkan (tersedia)";
    if (!confirm(`Yakin ingin ${action} tag ini?`)) return;

    try {
      await toggleTagStatus(uid);
    } catch (err: any) {
      alert("Gagal mengubah status: " + err.message);
    }
  }

  async function handleDeleteTag(uid: string, alias: string) {
    if (!confirm(`Yakin ingin menghapus tag ${alias}? Tag yang dihapus bisa didaftarkan ulang.`)) return;

    try {
      await deleteTag(uid);
    } catch (err: any) {
      alert("Gagal menghapus tag: " + err.message);
    }
  }

  async function handleUpdateProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTag) return;
    
    setError(null);
    if (editProductName.trim().length < 3) {
      setError("Nama barang minimal 3 karakter.");
      return;
    }

    const priceNum = parseInt(editPrice, 10);
    if (isNaN(priceNum) || priceNum <= 0) {
      setError("Harga harus angka positif.");
      return;
    }

    setLoading(true);
    try {
      await updateTag(selectedTag.uid, editProductName, priceNum);
      handleCloseModal();
    } catch (err: any) {
      setError("Gagal mengubah produk: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  const tagList = Object.entries(tags);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Manajemen Produk</h1>
          <p className="text-neutral-500">Ubah data produk atau status ketersediaan pada masing-masing tag.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-neutral-200 shadow-sm">
          <Tags className="w-5 h-5 text-blue-600" />
          <span className="font-medium text-neutral-700">{tagList.length} Total Tag</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-600">
            <thead className="bg-neutral-50 text-neutral-500 font-medium border-b border-neutral-200">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Alias</th>
                <th className="px-6 py-4">Nama Produk</th>
                <th className="px-6 py-4 whitespace-nowrap">Harga</th>
                <th className="px-6 py-4 whitespace-nowrap">Status</th>
                <th className="px-6 py-4 whitespace-nowrap">Terakhir Di-scan</th>
                <th className="px-6 py-4 text-right whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {tagList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-neutral-500">
                    Belum ada tag yang terdaftar di sistem.
                  </td>
                </tr>
              ) : (
                tagList.map(([uid, tag]) => (
                  <tr key={uid} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-neutral-900">
                      {tag.alias}
                      <span className="block text-xs text-neutral-400 font-mono mt-0.5">{uid}</span>
                    </td>
                    <td className="px-6 py-4 font-medium text-neutral-900">{tag.product_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      Rp {tag.price.toLocaleString("id-ID")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          tag.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {tag.is_active ? "Tersedia" : "Terjual"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-neutral-500">
                      {tag.last_scanned_at
                        ? formatRelative(new Date(tag.last_scanned_at * 1000), new Date(), { locale: id })
                        : "Belum pernah"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(uid, tag)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded text-neutral-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          title="Ubah Barang"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(uid, tag.is_active)}
                          className={`inline-flex items-center justify-center w-8 h-8 rounded transition-colors ${
                            tag.is_active
                              ? "text-neutral-500 hover:bg-neutral-100"
                              : "text-amber-500 hover:bg-amber-50"
                          }`}
                          title={tag.is_active ? "Set Terjual" : "Set Tersedia"}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTag(uid, tag.alias)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded text-neutral-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Hapus Tag"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {modalOpen && selectedTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
              <h3 className="text-lg font-bold text-neutral-900">Ubah Barang & Harga</h3>
              <button 
                onClick={handleCloseModal}
                className="p-1 rounded-md text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateProduct} className="p-6 space-y-4">
              <div className="mb-6 p-3 bg-neutral-50 rounded-lg flex gap-3 text-sm">
                <Tags className="w-5 h-5 text-neutral-400 flex-shrink-0" />
                <div>
                  <p className="text-neutral-500">Anda sedang mengubah produk untuk tag:</p>
                  <p className="font-semibold text-neutral-900">{selectedTag.tag.alias} <span className="font-normal text-neutral-400 font-mono text-xs ml-1">({selectedTag.uid})</span></p>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-md text-sm border border-red-100 flex items-center gap-2">
                   <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" /> {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-900">Nama Barang Baru</label>
                <input
                  type="text"
                  required
                  value={editProductName}
                  onChange={(e) => setEditProductName(e.target.value)}
                  className="flex h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-900">Harga (Rp)</label>
                <input
                  type="number"
                  required
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="flex h-11 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-neutral-500">Harga sebelumnya: Rp {selectedTag.tag.price.toLocaleString("id-ID")}</p>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                <strong className="block mb-1">Catatan Otomatis:</strong>
                Menyimpan perubahan ini akan otomatis mengatur ulang status barang menjadi <strong>Tersedia</strong>.
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2.5 rounded-md border border-neutral-200 text-neutral-600 font-medium hover:bg-neutral-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
