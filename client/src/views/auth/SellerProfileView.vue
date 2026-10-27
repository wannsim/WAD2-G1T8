<template>
  <div class="page-narrow">
    <h2 class="page-title">{{ myShopId ? 'Seller profile' : 'Seller profile setup' }}</h2>

    <!-- shop stats: how many people follow the shop, and how many listings it has -->
    <div v-if="myShopId" class="d-flex flex-wrap gap-3 mb-3">
      <div class="card shadow-sm text-center px-4 py-2">
        <div class="fs-3 fw-bold">{{ followerCount }}</div>
        <div class="small text-muted">{{ followerCount === 1 ? 'Follower' : 'Followers' }}</div>
      </div>
      <div class="card shadow-sm text-center px-4 py-2">
        <div class="fs-3 fw-bold">{{ listingCount }}</div>
        <div class="small text-muted">{{ listingCount === 1 ? 'Listing' : 'Listings' }}</div>
      </div>
      <RouterLink :to="`/shops/${myShopId}`" class="align-self-center small">View my shop as a buyer →</RouterLink>
    </div>
    <div v-if="message" class="alert alert-info">{{ message }}</div>

    <!-- view mode (the page opens like this once the shop exists) -->
    <section v-if="myShopId && !editing" class="card p-4 shadow-sm">
      <div class="d-flex align-items-center gap-3 mb-4">
        <AvatarEditor :src="shopPhoto" :name="profile.name" size="72px" />
        <div class="flex-grow-1" style="min-width: 0">
          <h3 class="h5 mb-1 text-truncate">{{ profile.name }}</h3>
          <p class="small text-muted mb-0">{{ profile.nearestMrt ? `Near ${profile.nearestMrt} MRT` : 'No MRT set' }}</p>
        </div>
        <button type="button" class="btn btn-primary edit-btn" @click="startEditing">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325" />
          </svg>
          Edit profile
        </button>
      </div>
      <dl class="profile-details mb-0">
        <div><dt>Shop name</dt><dd>{{ profile.name || '-' }}</dd></div>
        <div><dt>Nearest MRT</dt><dd>{{ profile.nearestMrt || 'Not set' }}</dd></div>
        <div class="full">
          <dt>Categories</dt>
          <dd>
            <span v-for="cat in profile.categories" :key="cat" class="detail-chip">{{ cat }}</span>
            <span v-if="!profile.categories?.length" class="text-muted">None added yet</span>
          </dd>
        </div>
        <div class="full"><dt>Experience &amp; background</dt><dd class="pre-line">{{ profile.experience || 'Not added' }}</dd></div>
        <div class="full">
          <dt>Certifications</dt>
          <dd>
            <span v-for="cert in profile.certifications" :key="cert" class="detail-chip">{{ cert }}</span>
            <span v-if="!profile.certifications?.length" class="text-muted">None added yet</span>
          </dd>
        </div>
      </dl>
    </section>

    <!-- edit mode (and the first-time setup, before the shop exists) -->
    <form v-else @submit.prevent="saveProfile" class="card p-4 shadow-sm">

      <div class="mb-3">
        <label class="form-label" for="shopName">Shop name <span class="text-danger">*</span></label>
        <input id="shopName" type="text" class="form-control" v-model="profile.name" maxlength="60" required
          :class="{ 'is-invalid': nameError }" @input="onNameInput">
        <div class="invalid-feedback">{{ nameError }}</div>
        <div v-if="!nameError" class="form-text">Must be different from every other shop on Homly Hauls.</div>
      </div>

      <div class="mb-3">
        <label class="form-label">Nearest MRT (for location pin)</label>
        <input type="text" class="form-control" v-model="profile.nearestMrt" placeholder="E.g. Dhoby Ghaut MRT" required>
      </div>

      <div class="mb-3">
        <label class="form-label">Categories (comma-separated)</label>
        <input type="text" class="form-control" v-model="categoriesInput" placeholder="E.g. baked goods, crafts">
      </div>

      <div class="mb-3">
        <label class="form-label">Experience & background</label>
        <textarea class="form-control" v-model="profile.experience" rows="3" placeholder="Describe your experience..."></textarea>
      </div>

      <div class="mb-3">
        <label class="form-label">Certifications (comma-separated)</label>
        <input type="text" class="form-control" v-model="certsInput" placeholder="E.g. WSQ Food Hygiene">
      </div>

      <div class="d-flex gap-2">
        <button v-if="myShopId" type="button" class="btn cancel-btn flex-fill" @click="cancelEditing">Cancel</button>
        <button type="submit" class="btn btn-primary flex-fill">{{ myShopId ? 'Update profile' : 'Create my shop' }}</button>
      </div>
    </form>

    <!-- Certificate photos (uploaded straight away, separate from the form above) -->
    <div class="card p-4 shadow-sm mt-4 mb-5">
      <h5>Certificate photos</h5>
      <p v-if="editing" class="text-muted small">Upload a photo or scan of each certificate so buyers can trust your shop (images only, max 5MB).</p>

      <p v-if="!myShopId" class="text-muted">Save your profile above first, then you can upload certificates.</p>

      <template v-else>
        <div v-if="editing" class="row g-2 align-items-end mb-3">
          <div class="col-md-5">
            <label class="form-label small">Certificate name</label>
            <input type="text" class="form-control" v-model.trim="certName" placeholder="E.g. WSQ Food Hygiene">
          </div>
          <div class="col-md-5">
            <label class="form-label small">Image</label>
            <input type="file" class="form-control" accept="image/*" ref="certFileInput" @change="onCertFileChange">
          </div>
          <div class="col-md-2">
            <button type="button" class="btn btn-outline-primary w-100" :disabled="!certFile || uploadingCert" @click="uploadCert">
              {{ uploadingCert ? 'Uploading...' : 'Upload' }}
            </button>
          </div>
        </div>
        <p v-if="certError" class="text-danger small">{{ certError }}</p>

        <p v-if="certFiles.length === 0" class="text-muted small">No certificate photos uploaded yet.{{ editing ? '' : ' Click Edit profile to add some.' }}</p>
        <div class="row g-3">
          <div v-for="cert in certFiles" :key="cert._id" class="col-6 col-md-3">
            <div class="card h-100">
              <a :href="certImageUrl(cert)" target="_blank">
                <img :src="certImageUrl(cert)" class="card-img-top product-img" :alt="cert.name" loading="lazy" decoding="async">
              </a>
              <div class="card-body p-2 d-flex justify-content-between align-items-center">
                <span class="small text-truncate" :title="cert.name">{{ cert.name }}</span>
                <button v-if="editing" type="button" class="btn btn-sm btn-outline-danger" @click="removeCert(cert)">Remove</button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { currentUser } from '@/utils/auth'
import { API_URL } from '@/utils/config'
import { myShopAvatar } from '@/utils/layout'
import AvatarEditor from '@/components/AvatarEditor.vue'

const profile = ref({ name: '', nearestMrt: '', experience: '', categories: [], certifications: [] })
const categoriesInput = ref('')
const certsInput = ref('')
const myShopId = ref('')
const followerCount = ref(0)
const listingCount = ref(0)
const message = ref('')
const shopPhoto = myShopAvatar // the shop's profile picture (changed on My shop -> click the circle)

// the page opens read-only once the shop exists; "Edit profile" shows the form, Save / Cancel go back to viewing.
// A seller without a shop yet goes straight to the form (first-time setup).
const editing = ref(false)
let savedProfile = null // copy of the last saved profile, so Cancel can throw away unsaved changes
function fillForm(shop) {
  profile.value = { ...shop }
  categoriesInput.value = shop.categories?.join(', ') || ''
  certsInput.value = shop.certifications?.join(', ') || ''
}
function startEditing() {
  message.value = ''
  editing.value = true
}
function cancelEditing() {
  if (savedProfile) fillForm(savedProfile)
  nameError.value = ''
  certError.value = ''
  message.value = ''
  editing.value = false
}

// certificate photos
const certFiles = ref([])       // [{ _id, name }] - the images themselves load from certImageUrl()
const certName = ref('')
const certFile = ref(null)
const certFileInput = ref(null)
const uploadingCert = ref(false)
const certError = ref('')

// shop names must be unique - check while the seller types (the server checks again when saving)
const nameError = ref('')
let nameTimer = null
const onNameInput = () => {
  nameError.value = ''
  clearTimeout(nameTimer)
  nameTimer = setTimeout(checkName, 400)
}
const checkName = async () => {
  const name = (profile.value.name || '').trim()
  if (!name) return
  try {
    const { data } = await axios.get(`${API_URL}/shops/name-available`, { params: { name, except: myShopId.value || undefined } })
    if (name === (profile.value.name || '').trim()) nameError.value = data.message // ignore answers for old text
  } catch (err) {
    console.error('Could not check shop name', err)
  }
}

const fetchProfile = async () => {
  try {
    if (!currentUser.value || !currentUser.value._id) return
    profile.value.name = currentUser.value.name + "'s Shop" // suggested name for a new shop

    // Fetch the shop tied to the logged-in user
    const { data } = await axios.get(`${API_URL}/shops/mine/${currentUser.value._id}`)
    if (data) {
      fillForm(data)
      savedProfile = { ...data }
      myShopId.value = data._id
      certFiles.value = data.certificationFiles || []
      followerCount.value = data.followers?.length || 0

      const products = await axios.get(`${API_URL}/products/shop/${data._id}`)
      listingCount.value = products.data.length
    } else {
      editing.value = true // no shop yet: start with the setup form
      checkName() // warn straight away if the suggested name is already taken
    }
  } catch (err) {
    console.error("Error fetching profile:", err)
  }
}

const saveProfile = async () => {
  if (!currentUser.value || !currentUser.value._id) {
    return alert("You must be logged in to save a profile.")
  }

  // Convert the comma strings back into arrays before saving
  profile.value.categories = categoriesInput.value.split(',').map(s => s.trim()).filter(Boolean)
  profile.value.certifications = certsInput.value.split(',').map(s => s.trim()).filter(Boolean)
  
  try {
    if (myShopId.value) {
      // If the shop already exists, update it
      await axios.put(`${API_URL}/shops/${myShopId.value}`, profile.value)
    } else {
      // If the shop does not exist yet, create a new one
      profile.value.owner = currentUser.value._id
      const res = await axios.post(`${API_URL}/shops`, profile.value)
      myShopId.value = res.data._id
    }
    nameError.value = ''
    savedProfile = { ...profile.value }
    message.value = 'Profile saved!'
    editing.value = false
  } catch (err) {
    if (err.response?.status === 409) {
      nameError.value = err.response.data.message // shop name already taken
      document.getElementById('shopName')?.focus()
      return
    }
    console.error(err)
    alert('Failed to save profile. Check console for details.')
  }
}

const certImageUrl = (cert) => `${API_URL}/shops/${myShopId.value}/certs/${cert._id}/image`

const onCertFileChange = (event) => {
  certError.value = ''
  certFile.value = event.target.files[0] || null
  if (certFile.value && certFile.value.size > 5 * 1024 * 1024) {
    certError.value = 'Image is too big (max 5MB)'
    certFile.value = null
  }
}

const uploadCert = async () => {
  if (!certFile.value) return
  uploadingCert.value = true
  certError.value = ''
  try {
    const formData = new FormData()
    formData.append('name', certName.value || certFile.value.name)
    formData.append('image', certFile.value)
    const res = await axios.post(`${API_URL}/shops/${myShopId.value}/certs`, formData)
    certFiles.value = res.data
    // clear the inputs for the next one
    certName.value = ''
    certFile.value = null
    if (certFileInput.value) certFileInput.value.value = ''
  } catch (err) {
    certError.value = err.response?.data?.message || 'Upload failed. Please try again.'
  } finally {
    uploadingCert.value = false
  }
}

const removeCert = async (cert) => {
  certError.value = ''
  try {
    const res = await axios.delete(`${API_URL}/shops/${myShopId.value}/certs/${cert._id}`)
    certFiles.value = res.data
  } catch (err) {
    certError.value = err.response?.data?.message || 'Could not remove the certificate.'
  }
}

onMounted(fetchProfile)
</script>

<style scoped>
.edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
  border-radius: 999px;
  padding: 0.5rem 1.2rem;
  font-weight: 600;
}
/* Cancel (edit mode): outlined, so it reads as a button */
.cancel-btn {
  border: 1.5px solid var(--line);
  background: var(--surface);
  color: var(--ink);
}
.cancel-btn:hover {
  border-color: var(--ocean);
  color: var(--ocean);
}
/* view mode: label above value, two columns on wide screens */
.profile-details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.1rem 2rem;
}
.profile-details .full {
  grid-column: 1 / -1;
}
.profile-details dt {
  margin-bottom: 0.2rem;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--muted);
}
.profile-details dd {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--ink);
}
.pre-line {
  white-space: pre-line;
}
.detail-chip {
  display: inline-block;
  margin: 0 0.4rem 0.4rem 0;
  padding: 0.3rem 0.85rem;
  border-radius: 999px;
  background: var(--ocean-soft);
  font-size: 0.85rem;
  color: var(--ocean-dark);
}
@media (max-width: 575.98px) {
  .profile-details {
    grid-template-columns: 1fr;
  }
}
</style>
