<script setup lang="ts">
import IconInput from '@/shared/components/IconInput.vue'
import IconSelect from '@/shared/components/IconSelect.vue'
import SelectWithOther from '@/shared/components/SelectWithOther.vue'

defineProps<{
  form: Record<string, any>
  errors: Record<string, string>
  patterns: Record<string, string>
  loading: { register: boolean; sendCode: boolean }
  positionOptions: string[]
  regionOptions: Record<string, string>
  researchFieldOptions: string[]
  validateField: (field: any) => void
  clearError: (field: any) => void
  register: () => void
}>()
</script>

<template>
  <div
    class="w-full lg:w-1/2 p-8 md:p-10 pb-8 flex flex-col flex-1 min-h-0 bg-base-50/50 dark:bg-base-200/20"
  >
    <div class="min-h-[72px] mb-4">
      <h3 class="text-2xl font-bold flex items-center gap-2">
        Researcher Profile
      </h3>
      <p class="text-base-content/60 text-base mt-3">Complete your professional details</p>
    </div>

    <div class="flex flex-col gap-5">
      <div class="min-h-[56px]">
        <IconInput
          v-model="form.institution"
          icon-type="institution"
          type="text"
          required
          validator
          placeholder="Institution / University"
          :pattern="patterns.institution"
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
          :options="regionOptions"
          icon-type="region"
          placeholder="Region"
          :error="errors.region"
          @change="validateField('region')"
          @focus="clearError('region')"
        />
      </div>
      <div class="min-h-[56px]">
        <SelectWithOther
          v-model="form.research_field"
          :options="researchFieldOptions"
          icon-type="research"
          required
          validator
          placeholder="Research Field"
          :error="errors.research_field"
          other-placeholder="Specify your field"
          @change="validateField('research_field')"
          @focus="clearError('research_field')"
          @blur="validateField('research_field')"
        />
      </div>
      <div class="min-h-[56px]">
        <IconInput
          v-model="form.orcid"
          icon-type="id-card"
          type="text"
          validator
          placeholder="ORCID (Optional)"
          :pattern="patterns.orcid"
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
          validator
          placeholder="Homepage URL (Optional)"
          :pattern="patterns.url"
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
