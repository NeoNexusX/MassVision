<script setup>
defineProps({
    type: {
        type: String,
        required: true,
        validator: v => ['user', 'password', 'email', 'viricode'].includes(v)
    }
})
</script>

<template>
    <svg class="h-[1em] opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <g stroke-linejoin="round" stroke-linecap="round" stroke-width="2.5" fill="none" stroke="currentColor">
            <!-- UserIcon -->
            <template v-if="type === 'user'">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
            </template>

            <!-- PasswordIcon -->
            <template v-if="type === 'password'">
                <path
                    d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
                <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
            </template>

            <!-- EmailIcon -->
            <template v-if="type === 'email'">
                <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
            </template>

            <!-- VericodeIcon -->
            <template v-if="type === 'vericode'">
            </template>
        </g>
    </svg>
</template>