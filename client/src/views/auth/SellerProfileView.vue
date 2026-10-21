<template>
  <div class="container mt-4">
    <h3>Seller Profile Setup</h3>

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
    <form @submit.prevent="saveProfile" class="card p-4 shadow-sm">

      <div class="mb-3">
        <label class="form-label" for="shopName">Shop Name <span class="text-danger">*</span></label>
        <input id="shopName" type="text" class="form-control" v-model="profile.name" maxlength="60" required
          :class="{ 'is-invalid': nameError }" @input="onNameInput">
        <div class="invalid-feedback">{{ nameError }}</div>
        <div v-if="!nameError" class="form-text">Must be different from every other shop on Homly Hauls.</div>
      </div>

      <div class="mb-3">
        <label class="form-label">Nearest MRT (For Location Pin)</label>
        <input type="text" class="form-control" v-model="profile.nearestMrt" placeholder="e.g. Dhoby Ghaut MRT" required>
      </div>

      <div class="mb-3">
        <label class="form-label">Categories (Comma-separated)</label>
        <input type="text" class="form-control" v-model="categoriesInput" placeholder="e.g. Baked Goods, Crafts">
      </div>

      <div class="mb-3">
        <label class="form-label">Experience & Background</label>
        <textarea class="form-control" v-model="profile.experience" rows="3" placeholder="Describe your experience..."></textarea>
      </div>

      <div class="mb-3">
        <label class="form-label">Certifications (Comma-separated)</label>
        <input type="text" class="form-control" v-model="certsInput" placeholder="e.g. WSQ Food Hygiene">
      </div>

      <button type="submit" class="btn btn-primary w-100">Update Profile</button>
    </form>

    <!-- Certificate photos (uploaded straight away, separate from the form above) -->
    <div class="card p-4 shadow-sm mt-4 mb-5">
      <h5>Certificate Photos</h5>
      <p class="text-muted small">Upload a photo or scan of each certificate so buyers can trust your shop (images only, max 5MB).</p>

      <p v-if="!myShopId" class="text-muted">Save your profile above first, then you can upload certificates.</p>

      <template v-else>
        <div class="row g-2 align-items-end mb-3">
          <div class="col-md-5">
            <label class="form-label small">Certificate name</label>
            <input type="text" class="form-control" v-model.trim="certName" placeholder="e.g. WSQ Food Hygiene">
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

        <p v-if="certFiles.length === 0" class="text-muted small">No certificate photos uploaded yet.</p>
        <div class="row g-3">
          <div v-for="cert in certFiles" :key="cert._id" class="col-6 col-md-3">
            <div class="card h-100">
              <a :href="certImageUrl(cert)" target="_blank">
                <img :src="certImageUrl(cert)" class="card-img-top product-img" :alt="cert.name" loading="lazy" decoding="async">
              </a>
              <div class="card-body p-2 d-flex justify-content-between align-items-center">
                <span class="small text-truncate" :title="cert.name">{{ cert.name }}</span>
                <button type="button" class="btn btn-sm btn-outline-danger" @click="removeCert(cert)">Remove</button>
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

const profile = ref({ name: '', nearestMrt: '', experience: '', categories: [], certifications: [] })
const categoriesInput = ref('')
const certsInput = ref('')
const myShopId = ref('')
const followerCount = ref(0)
const listingCount = ref(0)

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
      profile.value = data
      myShopId.value = data._id
      categoriesInput.value = data.categories?.join(', ') || ''
      certsInput.value = data.certifications?.join(', ') || ''
      certFiles.value = data.certificationFiles || []
      followerCount.value = data.followers?.length || 0

      const products = await axios.get(`${API_URL}/products/shop/${data._id}`)
      listingCount.value = products.data.length
    } else {
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
    alert('Profile Saved!')
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