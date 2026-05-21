<script setup lang="ts">
import IconInput from '@/shared/components/IconInput.vue'
import IconSelect from '@/shared/components/IconSelect.vue'

defineProps<{
  form: Record<string, any>
  errors: Record<string, string>
  loading: { register: boolean; sendCode: boolean }
  positionOptions: string[]
  regionOptions: Array<{ code: string; name: string }>
  researchFieldOptions: string[]
  isOtherResearchField: boolean
  customResearchField: string
  validateField: (field: any) => void
  clearError: (field: any) => void
  handleResearchFieldChange: (value: any) => void
  register: () => void
}>()

defineEmits<{
  (e: 'update:customResearchField', value: string): void
}>()
</script>

<template>
  <div
    class="w-full lg:w-1/2 p-8 md:p-10 pb-8 flex flex-col flex-1 min-h-0 bg-base-50/50 dark:bg-base-200/20"
  >
    <div class="min-h-[72px] mb-4">
      <h3 class="text-xl font-bold flex items-center gap-2">
        <svg-icon type="user" class="h-5 w-5 text-primary" />
        Researcher Profile
      </h3>
      <p class="text-base-content/60 text-sm mt-1">Complete your professional details</p>
    </div>

    <div class="flex flex-col gap-5">
      <div class="min-h-[56px]">
        <IconInput
          v-model="form.institution"
          icon-type="institution"
          type="text"
          required
          placeholder="Institution / University"
          :error="errors.institution"
          @blur="validateField('institution')"
          @focus="clearError('institution')"
        />
      </div>
      <div class="min-h-[56px]">
        <IconSelect
          v-model="form.position"
          :options="positionOptions"
          icon-type="position"
          placeholder="Position"
          :error="errors.position"
          @change="validateField('position')"
          @focus="clearError('position')"
        />
      </div>
      <div class="min-h-[56px]">
        <IconSelect
          v-model="form.region"
          :options="regionOptions.map((country) => ({ label: country.name, value: country.name }))"
          icon-type="region"
          placeholder="Region"
          :error="errors.region"
          @change="validateField('region')"
          @focus="clearError('region')"
        />
      </div>
      <div class="min-h-[56px]">
        <IconSelect
          v-model="form.research_field"
          :options="researchFieldOptions"
          icon-type="research"
          placeholder="Research Field"
          :error="errors.research_field"
          @change="handleResearchFieldChange"
          @focus="clearError('research_field')"
        >
          <input
            v-if="isOtherResearchField"
            type="text"
            :value="customResearchField"
            class="input input-bordered w-full mt-3 input-sm"
            placeholder="Specify your field"
            @input="$emit('update:customResearchField', ($event.target as HTMLInputElement).value)"
            @blur="validateField('research_field')"
          />
        </IconSelect>
      </div>
      <div class="min-h-[56px]">
        <IconInput
          v-model="form.orcid"
          icon-type="id-card"
          type="text"
          placeholder="ORCID (Optional)"
          :error="errors.orcid"
          @blur="validateField('orcid')"
          @focus="clearError('orcid')"
        />
      </div>
      <div class="min-h-[56px]">
        <IconInput
          v-model="form.homepage"
          icon-type="link"
          type="text"
          placeholder="Homepage URL (Optional)"
          :error="errors.homepage"
          @blur="validateField('homepage')"
          @focus="clearError('homepage')"
        />
      </div>
    </div>

    <div class="mt-auto pt-6">
      <button
        class="btn btn-primary w-full btn-lg shadow-xl hover:scale-[1.01] transition-transform"
        @click="register"
        :disabled="loading.register"
      >
        <span v-if="loading.register" class="loading loading-spinner loading-md"></span>
        <span v-else class="text-lg">Complete Registration</span>
      </button>
    </div>
  </div>
</template>
